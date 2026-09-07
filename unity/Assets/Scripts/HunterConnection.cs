using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using NativeWebSocket;

/// <summary>
/// Authoritative 10Hz client state reporting and batch envelope network parser
/// for Frost Leviathan: Harpoon Hunt (Cloudflare Workers + Durable Objects).
/// Hooks into VictoryOutroController upon MATCH_OVER VICTORY message.
/// </summary>
public class HunterConnection : MonoBehaviour
{
    [Header("Edge Connection")]
    public string workerEdgeHost = "wss://frost-leviathan.dondlingergc.com";
    public string playerId = "hunter_beta_1";
    public string callsign = "GlacierHunter";
    public string roomId = "glacial-trench-1";
    public float updateInterval = 0.1f; // 10Hz authoritative network update rate

    [Header("Local Player References")]
    public GameObject playerHunter;
    public HarpoonLauncher localHarpoon;
    public VictoryOutroController outroController;

    [Header("Network Replication")]
    public GameObject remoteHunterPrefab;
    public GameObject frostWhaleSegmentPrefab;
    private Dictionary<string, InterpolateMovement> remoteHunters = new Dictionary<string, InterpolateMovement>();
    private List<InterpolateMovement> whaleSegments = new List<InterpolateMovement>();

    private WebSocket websocket;
    private bool isMatchFinished = false;

    void Start()
    {
        if (string.IsNullOrEmpty(playerId))
        {
            playerId = "hunter_" + System.Guid.NewGuid().ToString().Substring(0, 8);
        }
        if (outroController == null)
        {
            outroController = FindObjectOfType<VictoryOutroController>();
        }
        ConnectToGlacierEdge();
    }

    async void ConnectToGlacierEdge()
    {
        string wsUrl = $"{workerEdgeHost}/ws?roomId={roomId}&playerId={playerId}&name={callsign}&level=1";
        websocket = new WebSocket(wsUrl);

        websocket.OnOpen += () => {
            Debug.Log($"[FrostLeviathan] Connected to Glacier Edge DO [{roomId}] as {playerId}");
        };

        websocket.OnError += (errMsg) => {
            Debug.LogError($"[FrostLeviathan] WebSocket Error: {errMsg}");
        };

        websocket.OnClose += (closeCode) => {
            Debug.LogWarning($"[FrostLeviathan] Disconnected from Edge ({closeCode}). Retrying in 3s...");
            if (!isMatchFinished)
            {
                Invoke("ConnectToGlacierEdge", 3.0f);
            }
        };

        websocket.OnMessage += (bytes) => ParseNetworkBatch(bytes);

        InvokeRepeating("SendPositionUpdate", 0.0f, updateInterval);

        await websocket.Connect();
    }

    void Update()
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        if (websocket != null)
        {
            websocket.DispatchMessageQueue();
        }
#endif
    }

    void SendPositionUpdate()
    {
        if (isMatchFinished) return;

        if (websocket != null && websocket.State == WebSocketState.Open && playerHunter != null)
        {
            var pos = playerHunter.transform.position;
            var rot = playerHunter.transform.rotation.eulerAngles;
            string harpoonState = localHarpoon != null ? localHarpoon.GetCurrentState() : "IDLE";

            string jsonPayload = $"{{\"type\":\"BATCH_UPDATE\",\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"messages\":[{{\"type\":\"POSITION_UPDATED\",\"playerId\":\"{playerId}\",\"position\":\"{pos.x:F2},{pos.y:F2},{pos.z:F2}\",\"rotation\":\"{rot.x:F2},{rot.y:F2},{rot.z:F2}\",\"state\":\"{harpoonState}\"}}]}}";
            websocket.SendText(jsonPayload);
        }
    }

    public void SendStateUpdate(string stateName)
    {
        if (isMatchFinished) return;

        if (websocket != null && websocket.State == WebSocketState.Open)
        {
            string payload = $"{{\"type\":\"BATCH_UPDATE\",\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"messages\":[{{\"type\":\"HARPOON_STATE_CHANGE\",\"playerId\":\"{playerId}\",\"state\":\"{stateName}\"}}]}}";
            websocket.SendText(payload);
        }
    }

    public void SendTowedSync(string targetColliderName)
    {
        if (isMatchFinished) return;

        if (websocket != null && websocket.State == WebSocketState.Open)
        {
            string payload = $"{{\"type\":\"BATCH_UPDATE\",\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"messages\":[{{\"type\":\"TOW_ENGAGED\",\"playerId\":\"{playerId}\",\"target\":\"{targetColliderName}\"}}]}}";
            websocket.SendText(payload);
        }
    }

    public void SendHarpoonHit(int targetWhaleSegment)
    {
        if (isMatchFinished) return;

        if (websocket != null && websocket.State == WebSocketState.Open)
        {
            string payload = $"{{\"type\":\"BATCH_UPDATE\",\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"messages\":[{{\"type\":\"HARPOON_HIT\",\"playerId\":\"{playerId}\",\"targetWhaleSeg\":{targetWhaleSegment}}}]}}";
            websocket.SendText(payload);
        }
    }

    public void SendLeviathanDamage(int damageAmount, bool isCrit)
    {
        if (isMatchFinished) return;

        if (websocket != null && websocket.State == WebSocketState.Open)
        {
            string payload = $"{{\"type\":\"BATCH_UPDATE\",\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"messages\":[{{\"type\":\"LEVIATHAN_DAMAGE\",\"playerId\":\"{playerId}\",\"damage\":{damageAmount},\"isCrit\":{isCrit.ToString().ToLower()}}}]}}";
            websocket.SendText(payload);
        }
    }

    void ParseNetworkBatch(byte[] bytes)
    {
        string rawJson = System.Text.Encoding.UTF8.GetString(bytes);
        try
        {
            BatchEnvelope envelope = JsonUtility.FromJson<BatchEnvelope>(rawJson);
            if (envelope != null && envelope.messages != null)
            {
                foreach (var msg in envelope.messages)
                {
                    HandleEdgeMessage(msg);
                }
            }
        }
        catch (System.Exception ex)
        {
            Debug.LogWarning($"Failed to deserialize edge frame: {ex.Message}");
        }
    }

    private void HandleEdgeMessage(GameMessage msg)
    {
        switch (msg.type)
        {
            case "PLAYER_MOVED":
                if (msg.playerId != playerId)
                {
                    UpdateRemoteHunter(msg.playerId, msg.position, msg.rotation);
                }
                break;

            case "PLAYER_TOWED_START":
                Debug.Log($"Hunter {msg.playerId} is now TOWED to whale segment {msg.whaleSection}!");
                break;

            case "LEVIATHAN_TICK":
                UpdateLeviathanSegments(msg);
                break;

            case "MATCH_OVER":
                if (msg.outcome == "VICTORY" && !isMatchFinished)
                {
                    isMatchFinished = true;
                    CancelInvoke("SendPositionUpdate");
                    if (outroController != null)
                    {
                        outroController.TriggerVictorySequence();
                    }
                }
                break;
        }
    }

    private void UpdateRemoteHunter(string id, string posStr, string rotStr)
    {
        if (!remoteHunters.ContainsKey(id))
        {
            if (remoteHunterPrefab != null)
            {
                GameObject newHunter = Instantiate(remoteHunterPrefab);
                InterpolateMovement interp = newHunter.GetComponent<InterpolateMovement>();
                remoteHunters.Add(id, interp);
            }
            else
            {
                return;
            }
        }

        InterpolateMovement hunter = remoteHunters[id];
        string[] posParts = posStr.Split(',');
        if (posParts.Length == 3)
        {
            hunter.endPosition = new Vector3(float.Parse(posParts[0]), float.Parse(posParts[1]), float.Parse(posParts[2]));
        }

        string[] rotParts = rotStr.Split(',');
        if (rotParts.Length == 3)
        {
            hunter.endRotation = Quaternion.Euler(float.Parse(rotParts[0]), float.Parse(rotParts[1]), float.Parse(rotParts[2]));
        }
    }

    private void UpdateLeviathanSegments(GameMessage msg)
    {
    }

    private async void OnApplicationQuit()
    {
        CancelInvoke("SendPositionUpdate");
        if (websocket != null)
        {
            await websocket.Close();
        }
    }

    [System.Serializable]
    public class BatchEnvelope
    {
        public string type;
        public long timestamp;
        public List<GameMessage> messages;
    }

    [System.Serializable]
    public class GameMessage
    {
        public string type;
        public string outcome;
        public string playerId;
        public string position;
        public string rotation;
        public string state;
        public int whaleSection;
        public float x, y, z;
        public float hp, maxHp;
    }
}
