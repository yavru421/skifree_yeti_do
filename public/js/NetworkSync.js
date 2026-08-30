// public/js/NetworkSync.js
// Cloudflare Durable Object WebSocket Network Client & SQLite Score Publishing

export class NetworkSync {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.callsign = "YetiSlayer";
    this.roomId = "main-alps";
    this.gameMode = "hunt";
    this.isConnected = false;
    this.reconnectTimer = null;

    this.remotePlayers = new Map();
    this.onMessageCallback = null;
  }

  getCredentials() {
    let hunterId = localStorage.getItem('skifree_hunter_id');
    let pin = localStorage.getItem('skifree_hunter_pin');
    if (!hunterId) {
      hunterId = 'hunt_' + Math.random().toString(36).slice(2, 11);
      localStorage.setItem('skifree_hunter_id', hunterId);
    }
    if (!pin) {
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      localStorage.setItem('skifree_hunter_pin', pin);
    }
    return { hunterId, pin };
  }

  connect(roomId, callsign, mode, onMessage) {
    this.roomId = roomId || "main-alps";
    this.callsign = callsign || "YetiSlayer";
    this.gameMode = mode || "hunt";
    this.onMessageCallback = onMessage;

    const { hunterId } = this.getCredentials();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(this.roomId)}&callsign=${encodeURIComponent(this.callsign)}&hunterId=${encodeURIComponent(hunterId)}&mode=${encodeURIComponent(this.gameMode)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        const toast = document.getElementById("network-toast");
        if (toast) toast.style.display = "none";
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "WELCOME") {
            this.playerId = msg.playerId;
          }
          if (this.onMessageCallback) {
            this.onMessageCallback(msg);
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        const toast = document.getElementById("network-toast");
        if (toast) toast.style.display = "block";
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect(this.roomId, this.callsign, this.gameMode, this.onMessageCallback);
        }, 3000);
      };

      this.ws.onerror = () => {
        this.ws.close();
      };
    } catch (e) {
      console.warn("WebSocket connection error:", e);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendTelemetry(x, z, speed, steer, pitch) {
    this.send({
      type: "INPUT",
      x,
      z,
      speed,
      steer,
      pitch
    });
  }

  sendReady(isReady, mode) {
    this.send({
      type: "READY",
      ready: isReady,
      mode: mode || this.gameMode
    });
  }

  sendForceLaunch(mode) {
    this.send({
      type: "FORCE_LAUNCH",
      mode: mode || this.gameMode
    });
  }

  sendShootHit(isCrit) {
    this.send({
      type: "SHOOT",
      hit: true,
      crit: isCrit
    });
  }

  sendDropBait() {
    this.send({
      type: "DROP_BAIT"
    });
  }

  async fetchLeaderboard() {
    try {
      const res = await fetch(`/api/scores?room=${encodeURIComponent(this.roomId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { leaderboard: [], raceLeaderboard: [] };
  }

  async publishScore(callsign, pin, scoreData) {
    const { hunterId } = this.getCredentials();
    const payload = {
      hunterId,
      callsign,
      pin,
      ...scoreData
    };

    try {
      const res = await fetch("/api/publish-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
