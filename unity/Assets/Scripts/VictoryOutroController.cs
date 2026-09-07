using UnityEngine;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// GTA V-style cinematic celebration sequence for Frost Leviathan: Harpoon Hunt.
/// Triggers slow-motion tracking camera, player sideways power-slide stop,
/// celebratory NPC crew wedge formation with snow spray, and dance-punk audio transition.
/// </summary>
public class VictoryOutroController : MonoBehaviour
{
    [Header("Cinematic Camera Settings")]
    public Camera mainCamera;
    public Transform cameraOutroMount;           // Low-angle mount looking upward at player & downed Yeti
    public float slowMoTimeScale = 0.5f;         // 50% slow-mo
    public float cameraTransitionSpeed = 3.5f;

    [Header("Player Control Handover")]
    public GameObject playerSkier;
    public float slideStopDuration = 1.8f;

    [Header("NPC Crew Swarm")]
    public GameObject[] npcCrewPrefabs;          // Array of celebratory skier/snowboarder models
    public Transform[] npcSpawnPoints;           // Off-screen spawn anchors on both left and right flanks
    public Transform[] npcTargetStopPoints;      // V-shaped wedge formation stopping points
    public ParticleSystem snowSprayParticlePrefab;

    [Header("Audio Transition")]
    public AudioSource musicSource;
    public AudioClip gtaRadioMirrorParkTrack;    // 138 BPM garage-rock / dance-punk anthem
    public AudioSource ambientWindSource;

    [Header("UI Victory Stamp")]
    public GameObject victoryCanvas;             // "LEVIATHAN TAMED" neon-red retro banner

    private bool isOutroActive = false;
    private Rigidbody playerRb;
    private MobileSwipeController mobileController;

    void Awake()
    {
        if (mainCamera == null) mainCamera = Camera.main;
        if (playerSkier != null)
        {
            playerRb = playerSkier.GetComponent<Rigidbody>();
            mobileController = playerSkier.GetComponent<MobileSwipeController>();
        }
        if (victoryCanvas != null) victoryCanvas.SetActive(false);
    }

    /// <summary>
    /// Invoked when server broadcasts MATCH_OVER with outcome VICTORY
    /// </summary>
    public void TriggerVictorySequence()
    {
        if (isOutroActive) return;
        isOutroActive = true;

        // 1. Cut ambient wind, crank 138 BPM dance-punk victory track
        if (ambientWindSource != null) ambientWindSource.Stop();
        if (musicSource != null && gtaRadioMirrorParkTrack != null)
        {
            musicSource.clip = gtaRadioMirrorParkTrack;
            musicSource.volume = 1.0f;
            musicSource.pitch = 1.0f; // Keep music pitch steady despite slow-mo
            musicSource.Play();
        }

        // 2. Disable player inputs and engage smooth sideways slide-stop
        if (mobileController != null) mobileController.enabled = false;
        StartCoroutine(PlayerPowerSlideStop());

        // 3. Engage slow-mo cinematic camera tracking
        Time.timeScale = slowMoTimeScale;
        Time.fixedDeltaTime = 0.02f * Time.timeScale;
        StartCoroutine(CinematicCameraPan());

        // 4. Spawn the crew wedge formation from off-screen
        StartCoroutine(SpawnNpcCrewSwarm());

        // 5. Display the neon "LEVIATHAN TAMED" badge
        if (victoryCanvas != null)
        {
            StartCoroutine(ShowVictoryBannerWithDelay(1.2f));
        }
    }

    private IEnumerator PlayerPowerSlideStop()
    {
        if (playerRb == null) yield break;

        float elapsed = 0f;
        Vector3 initialVelocity = playerRb.velocity;
        Quaternion startRot = playerSkier.transform.rotation;
        // Turn 80 degrees sideways to execute classic hockey/skier powder spray stop facing camera
        Quaternion endRot = Quaternion.Euler(startRot.eulerAngles.x, startRot.eulerAngles.y + 75f, startRot.eulerAngles.z);

        while (elapsed < slideStopDuration)
        {
            elapsed += Time.unscaledDeltaTime;
            float t = elapsed / slideStopDuration;

            // Decelerate smoothly to halt
            playerRb.velocity = Vector3.Lerp(initialVelocity, Vector3.zero, Mathf.SmoothStep(0f, 1f, t));
            playerSkier.transform.rotation = Quaternion.Slerp(startRot, endRot, Mathf.SmoothStep(0f, 1f, t));

            yield return null;
        }

        playerRb.velocity = Vector3.zero;
    }

    private IEnumerator CinematicCameraPan()
    {
        if (mainCamera == null || cameraOutroMount == null) yield break;

        // Detach camera from character hierarchy to float independently
        mainCamera.transform.SetParent(null);

        Vector3 startPos = mainCamera.transform.position;
        Quaternion startRot = mainCamera.transform.rotation;

        float elapsed = 0f;
        float duration = 2.5f;

        while (elapsed < duration)
        {
            elapsed += Time.unscaledDeltaTime;
            float t = elapsed / duration;

            mainCamera.transform.position = Vector3.Lerp(startPos, cameraOutroMount.position, Mathf.SmoothStep(0f, 1f, t));
            mainCamera.transform.rotation = Quaternion.Slerp(startRot, cameraOutroMount.rotation, Mathf.SmoothStep(0f, 1f, t));

            yield return null;
        }
    }

    private IEnumerator SpawnNpcCrewSwarm()
    {
        int spawnCount = Mathf.Min(npcSpawnPoints.Length, npcTargetStopPoints.Length);

        for (int i = 0; i < spawnCount; i++)
        {
            Transform spawnPt = npcSpawnPoints[i];
            Transform targetPt = npcTargetStopPoints[i];
            GameObject prefab = (npcCrewPrefabs != null && npcCrewPrefabs.Length > 0)
                ? npcCrewPrefabs[i % npcCrewPrefabs.Length]
                : null;

            if (spawnPt != null && targetPt != null && prefab != null)
            {
                GameObject npc = Instantiate(prefab, spawnPt.position, spawnPt.rotation);
                StartCoroutine(AnimateNpcRider(npc, targetPt.position, i * 0.15f));
            }
        }

        yield break;
    }

    private IEnumerator AnimateNpcRider(GameObject npc, Vector3 targetPos, float delay)
    {
        yield return new WaitForSecondsRealtime(delay);

        float duration = 1.6f;
        float elapsed = 0f;
        Vector3 startPos = npc.transform.position;

        while (elapsed < duration)
        {
            elapsed += Time.unscaledDeltaTime;
            float t = elapsed / duration;

            npc.transform.position = Vector3.Lerp(startPos, targetPos, Mathf.SmoothStep(0f, 1f, t));
            yield return null;
        }

        // Execute sideways carve and trigger powder snow spray at camera
        Quaternion finalCarve = Quaternion.Euler(npc.transform.eulerAngles.x, npc.transform.eulerAngles.y + 60f, npc.transform.eulerAngles.z);
        npc.transform.rotation = finalCarve;

        if (snowSprayParticlePrefab != null)
        {
            ParticleSystem spray = Instantiate(snowSprayParticlePrefab, npc.transform.position, Quaternion.LookRotation(mainCamera.transform.position - npc.transform.position));
            spray.Play();
            Destroy(spray.gameObject, 2.5f);
        }

        // Trigger victory celebration pose / grab gesture (e.g. Alpine Star or High-Five)
        Animator anim = npc.GetComponentInChildren<Animator>();
        if (anim != null)
        {
            anim.SetTrigger("CelebrateVictory");
        }
    }

    private IEnumerator ShowVictoryBannerWithDelay(float delaySeconds)
    {
        yield return new WaitForSecondsRealtime(delaySeconds);
        if (victoryCanvas != null)
        {
            victoryCanvas.SetActive(true);
        }
    }
}
