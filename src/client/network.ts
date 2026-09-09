/**
 * SkiFree Yeti DO - 20Hz Authoritative Edge WebSocket Client
 * Connects to MountainDO on Cloudflare Workers edge, handles packet serialization,
 * 20Hz state interpolation, client-side input dispatch, and combat event transmission.
 */

import { GameStatePacket, InputPacket, HitscanPacket, PlayerNetState, YetiNetState } from "./types";

export class NetworkSystem {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private callsign: string;
  private roomId: string;
  private seq: number = 0;
  private isConnected: boolean = false;
  private onStateUpdate: (packet: GameStatePacket) => void;

  constructor(
    callsign: string,
    roomId: string,
    onState: (packet: GameStatePacket) => void
  ) {
    this.callsign = callsign;
    this.roomId = roomId;
    this.onStateUpdate = onState;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(
      this.roomId
    )}&callsign=${encodeURIComponent(this.callsign)}`;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log(`[Network] Connected to MountainDO room ${this.roomId} as ${this.callsign}`);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const packet: GameStatePacket = JSON.parse(event.data);
          if (packet && packet.type === "state") {
            this.onStateUpdate(packet);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.warn("[Network] Connection lost. Reconnecting in 2s...");
        setTimeout(() => this.connect(), 2000);
      };

      this.ws.onerror = (err) => {
        console.error("[Network] WebSocket error:", err);
      };
    } catch (err) {
      console.error("[Network] Failed to instantiate WebSocket:", err);
    }
  }

  public sendInput(steer: number, tuck: boolean, brake: boolean, aimAngle: number, isAiming: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const inputPkt: InputPacket = {
      type: "input",
      steer,
      tuck,
      brake,
      aimAngle,
      aimPitch: 0,
      isAiming,
      seq: this.seq++
    };

    this.ws.send(JSON.stringify(inputPkt));
  }

  public sendHitscan(packet: HitscanPacket): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(packet));
  }

  public isReady(): boolean {
    return this.isConnected;
  }
}
