/**
 * LobbyUI.ts
 * Manages client-side room lifecycle transitions between the Landing Menu,
 * Waiting Lobby Room, and Active 3D Gameplay Canvas.
 */

export interface LobbyPlayer {
  id: string;
  callsign: string;
  isReady: boolean;
  isHost: boolean;
}

export interface LobbyState {
  roomCode: string;
  status: 'WAITING' | 'IN_GAME' | 'GAME_OVER';
  preset: 'EASY' | 'MEDIUM' | 'PRO';
  players: LobbyPlayer[];
}

export class LobbyUIManager {
  private socket: WebSocket | null = null;
  private currentRoomCode: string | null = null;
  private localPlayerId: string | null = null;

  private onGameStartCallback?: (roomCode: string, ws: WebSocket) => void;

  constructor(onGameStart: (roomCode: string, ws: WebSocket) => void) {
    this.onGameStartCallback = onGameStart;
    this.bindDOMEvents();
  }

  private bindDOMEvents(): void {
    // Create Room Button
    const createBtn = document.getElementById('btn-create-room');
    if (createBtn) createBtn.addEventListener('click', () => this.handleCreateRoom());

    // Join Room Form
    const joinForm = document.getElementById('form-join-room');
    if (joinForm) {
      joinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleJoinRoom();
      });
    }

    // Toggle Ready Button
    const readyBtn = document.getElementById('btn-toggle-ready');
    if (readyBtn) readyBtn.addEventListener('click', () => this.toggleReady());

    // Host Start Game Button
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());

    // Preset Selector Buttons
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const preset = target.getAttribute('data-preset') as 'EASY' | 'MEDIUM' | 'PRO';
        this.setPreset(preset);
      });
    });
  }

  /**
   * Request room code generation from Cloudflare Worker
   */
  public async handleCreateRoom(): Promise<void> {
    const callsignInput = (document.getElementById('input-callsign') as HTMLInputElement)?.value?.trim() || '';
    const callsign = callsignInput || `Skier_${Math.floor(Math.random() * 8999 + 1000)}`;

    try {
      const response = await fetch('/api/lobby/create', { method: 'POST' });
      const data = (await response.json()) as { roomCode: string };

      this.connectToLobby(data.roomCode, callsign);
    } catch (err) {
      alert(`Room creation error: ${(err as Error).message}`);
    }
  }

  public handleJoinRoom(): void {
    const roomInput = (document.getElementById('input-room-code') as HTMLInputElement)?.value?.trim().toUpperCase() || '';
    const callsignInput = (document.getElementById('input-callsign') as HTMLInputElement)?.value?.trim() || '';
    const callsign = callsignInput || `Skier_${Math.floor(Math.random() * 8999 + 1000)}`;

    if (!roomInput || roomInput.length < 4) {
      alert('Please enter a valid 6-character room code (e.g. YETI-42)');
      return;
    }

    this.connectToLobby(roomInput, callsign);
  }

  /**
   * Upgrade connection to WebSocket and enter Lobby Waiting Room
   */
  private connectToLobby(roomCode: string, callsign: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(roomCode)}&callsign=${encodeURIComponent(callsign)}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.currentRoomCode = roomCode;
      this.showScreen('screen-waiting-lobby');
      const displayEl = document.getElementById('display-room-code');
      if (displayEl) displayEl.innerText = roomCode;
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch (err) {
        // Binary or non-JSON frame
      }
    };

    this.socket.onerror = (err) => {
      console.error('Lobby WS Error:', err);
      alert('Connection error to lobby DO');
    };

    this.socket.onclose = () => {
      console.log('Lobby WS Closed');
    };
  }

  private handleServerMessage(msg: any): void {
    switch (msg.type) {
      case 'INIT_SESSION':
        this.localPlayerId = msg.playerId;
        break;

      case 'LOBBY_STATE_SYNC':
        this.updateLobbyUI(msg.lobbyState);
        break;

      case 'GAME_START_SIGNAL':
        this.showScreen('screen-game-canvas');
        if (this.socket && this.currentRoomCode && this.onGameStartCallback) {
          this.onGameStartCallback(this.currentRoomCode, this.socket);
        }
        break;
    }
  }

  private updateLobbyUI(state: LobbyState): void {
    if (!state || !state.players) return;

    // Render Player Roster List
    const rosterList = document.getElementById('lobby-player-roster');
    if (rosterList) {
      rosterList.innerHTML = state.players
        .map(
          (p) => `
          <div class="player-card ${p.id === this.localPlayerId ? 'local-player' : ''}">
            <span class="player-name">${p.callsign} ${p.isHost ? '👑 (Host)' : ''}</span>
            <span class="player-status ${p.isReady ? 'ready' : 'not-ready'}">
              ${p.isReady ? 'READY' : 'NOT READY'}
            </span>
          </div>
        `
        )
        .join('');
    }

    // Toggle Host Controls Visibility
    const localPlayer = state.players.find((p) => p.id === this.localPlayerId);
    const isHost = localPlayer?.isHost ?? false;
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.classList.toggle('hidden', !isHost);
      const allReady = state.players.every((p) => p.isReady);
      (startBtn as HTMLButtonElement).disabled = !allReady;
    }

    // Active Difficulty Preset Highlight
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      const preset = btn.getAttribute('data-preset');
      btn.classList.toggle('active', preset === state.preset);
    });
  }

  private toggleReady(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'TOGGLE_READY' }));
    }
  }

  private setPreset(preset: 'EASY' | 'MEDIUM' | 'PRO'): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'SET_PRESET', preset }));
    }
  }

  private startGame(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'START_GAME' }));
    }
  }

  private showScreen(screenId: string): void {
    document.querySelectorAll('.app-screen').forEach((screen) => {
      screen.classList.add('hidden');
    });
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
  }
}
