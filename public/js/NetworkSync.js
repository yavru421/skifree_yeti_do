// public/js/NetworkSync.js
// Cloudflare Durable Object WebSocket Network Client for Frost Leviathan: Harpoon Hunt

export class NetworkSync {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.callsign = "HarpoonHunter";
    this.roomId = "glacial-trench-1";
    this.isConnected = false;
    this.reconnectTimer = null;

    this.remoteHunters = new Map();
    this.whaleState = null;
    this.onMessageCallback = null;
  }

  getCredentials() {
    let hunterId = localStorage.getItem('frost_hunter_id');
    let callsign = localStorage.getItem('frost_hunter_callsign');
    if (!hunterId) {
      hunterId = 'hunter_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('frost_hunter_id', hunterId);
    }
    if (!callsign) {
      callsign = 'Hunter-' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('frost_hunter_callsign', callsign);
    }
    return { hunterId, callsign };
  }

  connect(roomId, callsign, onMessage) {
    this.roomId = roomId || "glacial-trench-1";
    this.callsign = callsign || this.getCredentials().callsign;
    this.onMessageCallback = onMessage;

    const { hunterId } = this.getCredentials();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(this.roomId)}&playerId=${encodeURIComponent(hunterId)}&name=${encodeURIComponent(this.callsign)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        const toast = document.getElementById("network-toast");
        if (toast) toast.style.display = "none";
      };

      this.ws.onmessage = (event) => {
        try {
          const batch = JSON.parse(event.data);
          if (batch.type === "BATCH_UPDATE" && Array.isArray(batch.messages)) {
            for (const msg of batch.messages) {
              this.processMessage(msg);
            }
          } else if (Array.isArray(batch.messages)) {
            for (const msg of batch.messages) {
              this.processMessage(msg);
            }
          } else if (batch.type) {
            this.processMessage(batch);
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        const toast = document.getElementById("network-toast");
        if (toast) toast.style.display = "block";
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect(this.roomId, this.callsign, this.onMessageCallback);
        }, 3000);
      };

      this.ws.onerror = () => {
        this.ws.close();
      };
    } catch (e) {
      console.warn("WebSocket connection error:", e);
    }
  }

  private_send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const envelope = {
        type: "BATCH_UPDATE",
        timestamp: Date.now(),
        messages: [msg]
      };
      this.ws.send(JSON.stringify(envelope));
    }
  }

  processMessage(msg) {
    switch (msg.type) {
      case "WELCOME":
        this.playerId = msg.playerId;
        break;

      case "LEVIATHAN_TICK":
        this.whaleState = msg;
        break;

      case "PLAYER_MOVED":
        if (msg.playerId !== this.playerId) {
          this.remoteHunters.set(msg.playerId, msg);
        }
        break;

      case "PLAYER_DISCONNECTED":
        this.remoteHunters.delete(msg.playerId);
        break;
    }

    if (this.onMessageCallback) {
      this.onMessageCallback(msg);
    }
  }

  // 10Hz authoritative position reporting
  sendPositionUpdate(x, y, z, rotX, rotY, rotZ, speed, harpoonState) {
    this.private_send({
      type: "POSITION_UPDATED",
      playerId: this.playerId,
      position: `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`,
      rotation: `${rotX.toFixed(2)},${rotY.toFixed(2)},${rotZ.toFixed(2)}`,
      speed: speed || 25.0,
      state: harpoonState || "IDLE"
    });
  }

  // High-frequency 10Hz TOWED_TICK for speed & duration sync
  sendTowedTick(currentSpeed) {
    this.private_send({
      type: "TOWED_TICK",
      currentSpeed: Number(currentSpeed) || 80.0
    });
  }

  // Harpoon Hit: bind cable to whale segment
  sendHarpoonHit(targetWhaleSeg = 3) {
    this.private_send({
      type: "HARPOON_HIT",
      playerId: this.playerId,
      targetWhaleSeg
    });
  }

  // Release cable manually
  sendHarpoonReleased() {
    this.private_send({
      type: "HARPOON_RELEASED"
    });
  }

  // Crash into pine tree or obstacle while towed
  sendPlayerCrashed() {
    this.private_send({
      type: "PLAYER_CRASHED"
    });
  }

  // Deal damage to the Frost Leviathan health pool
  sendLeviathanDamage(damage, isCrit = false) {
    this.private_send({
      type: "LEVIATHAN_DAMAGE",
      playerId: this.playerId,
      damage,
      isCrit
    });
  }

  async fetchLeaderboard() {
    try {
      const res = await fetch(`/api/scores?room=${encodeURIComponent(this.roomId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { leaderboard: [], sessionLogs: [] };
  }
}
