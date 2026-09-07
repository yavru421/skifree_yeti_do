using UnityEngine;
using System.Collections;

public enum HarpoonState { READY, FLYING, ATTACHED, RETRACTING, COOLDOWN }

public class HarpoonLauncher : MonoBehaviour
{
    [Header("Level 1 Onboarding Overrides")]
    public bool isLevelOneOnboarding = true;      // Magnetic assist & generous collision
    public float magneticAssistAngle = 18.0f;     // Max cone angle (degrees) to steer projectile
    public float magneticSearchRadius = 40.0f;    // Max distance to look for beast weakpoints
    public float levelOnePullImpulseMultiplier = 1.8f; // Breathless "yanked forward" burst

    [Header("Launcher Settings")]
    public float projectileSpeed = 110f;          // Speed of harpoon (meters/sec)
    public float maxTetherRange = 75f;            // Maximum cast range
    public float retractionSpeed = 45f;           // Speed the line reels back in on miss
    public float baseCooldown = 5.0f;             // Standard reload timer
    public float levelOneCooldown = 1.5f;         // Rapid reload on Level 1 training run

    [Header("VFX & SFX")]
    public Transform muzzleOrigin;
    public ParticleSystem reelSparksParticle;
    public LineRenderer lineRenderer;

    // Component References
    private SSXTrickSystem trickSystem;
    private TetherCable tetherCable;
    private HunterConnection network;
    private Rigidbody playerRb;

    // State Machine Properties
    private HarpoonState currentState = HarpoonState.READY;
    private Vector3 activeSpearPosition;
    private Vector3 activeFlightDirection;
    private float currentCooldownTimer = 0f;

    void Awake()
    {
        trickSystem = GetComponent<SSXTrickSystem>();
        tetherCable = GetComponent<TetherCable>();
        network = GetComponent<HunterConnection>();
        playerRb = GetComponentInParent<Rigidbody>();

        if (muzzleOrigin == null)
            muzzleOrigin = transform;

        if (lineRenderer != null)
        {
            lineRenderer.positionCount = 2;
            lineRenderer.enabled = false;
        }
    }

    void Update()
    {
        // 1. Cooldown Management
        if (currentState == HarpoonState.COOLDOWN)
        {
            currentCooldownTimer -= Time.deltaTime;
            if (currentCooldownTimer <= 0)
            {
                currentState = HarpoonState.READY;
            }
        }

        // 2. Fire Input
        if (currentState == HarpoonState.READY && (Input.GetKeyDown(KeyCode.Space) || Input.GetMouseButtonDown(0)))
        {
            TriggerMobileLaunch();
        }

        // 3. Flight & Retraction Processing
        if (currentState == HarpoonState.FLYING)
        {
            SimulateHarpoonFlight();
        }
        else if (currentState == HarpoonState.RETRACTING)
        {
            SimulateRetraction();
        }
    }

    public void TriggerMobileLaunch()
    {
        if (currentState != HarpoonState.READY) return;

        currentState = HarpoonState.FLYING;
        activeSpearPosition = muzzleOrigin.position;
        activeFlightDirection = muzzleOrigin.forward;

        // Level 1 Magnetic Auto-Aim Assist: Snap trajectory if target is within 15-18 degree cone
        if (isLevelOneOnboarding)
        {
            Transform assistedTarget = FindMagneticAssistTarget();
            if (assistedTarget != null)
            {
                activeFlightDirection = (assistedTarget.position - muzzleOrigin.position).normalized;
            }
        }

        if (lineRenderer != null) lineRenderer.enabled = true;
        network?.SendStateUpdate("FIRED");
    }

    private Transform FindMagneticAssistTarget()
    {
        GameObject[] beastColliders = GameObject.FindGameObjectsWithTag("FrostLeviathan");
        Transform bestTarget = null;
        float bestAngle = magneticAssistAngle;

        foreach (GameObject beast in beastColliders)
        {
            Vector3 toTarget = beast.transform.position - muzzleOrigin.position;
            float dist = toTarget.magnitude;

            if (dist <= maxTetherRange)
            {
                float angle = Vector3.Angle(muzzleOrigin.forward, toTarget.normalized);
                if (angle < bestAngle)
                {
                    bestAngle = angle;
                    bestTarget = beast.transform;
                }
            }
        }

        return bestTarget;
    }

    private void SimulateHarpoonFlight()
    {
        float step = projectileSpeed * Time.deltaTime;
        activeSpearPosition += activeFlightDirection * step;

        if (lineRenderer != null)
        {
            lineRenderer.SetPosition(0, muzzleOrigin.position);
            lineRenderer.SetPosition(1, activeSpearPosition);
        }

        // Collision Check
        if (Physics.Raycast(activeSpearPosition - (activeFlightDirection * step), activeFlightDirection, out RaycastHit hit, step + 0.1f))
        {
            if (hit.collider.CompareTag("FrostLeviathan"))
            {
                AttachToBeast(hit);
                return;
            }
            else
            {
                StartRetraction();
                return;
            }
        }

        // Exceeded Range
        if (Vector3.Distance(muzzleOrigin.position, activeSpearPosition) >= maxTetherRange)
        {
            StartRetraction();
        }
    }

    private void AttachToBeast(RaycastHit hit)
    {
        currentState = HarpoonState.ATTACHED;

        // 1. Instant Acceleration Kick: Apply breathless velocity impulse to player
        if (playerRb != null)
        {
            float impulseMultiplier = isLevelOneOnboarding ? levelOnePullImpulseMultiplier : 1.0f;
            Vector3 pullDir = (hit.point - playerRb.position).normalized;
            playerRb.AddForce(pullDir * (38f * impulseMultiplier), ForceMode.VelocityChange);
        }

        // 2. Engage physical cable
        if (tetherCable != null)
        {
            tetherCable.AttachTether(muzzleOrigin, hit.collider.transform, playerRb);
        }

        // 3. Level 1 Damage Boost: 50 Damage per hit against 100 HP Yeti
        int damage = isLevelOneOnboarding ? 50 : 25;
        network?.SendLeviathanDamage(damage, isCrit: true);
        network?.SendTowedSync(hit.collider.name);
    }

    private void StartRetraction()
    {
        currentState = HarpoonState.RETRACTING;
        if (reelSparksParticle != null) reelSparksParticle.Play();
    }

    private void SimulateRetraction()
    {
        float step = retractionSpeed * Time.deltaTime;
        activeSpearPosition = Vector3.MoveTowards(activeSpearPosition, muzzleOrigin.position, step);

        if (lineRenderer != null)
        {
            lineRenderer.SetPosition(0, muzzleOrigin.position);
            lineRenderer.SetPosition(1, activeSpearPosition);
        }

        if (Vector3.Distance(activeSpearPosition, muzzleOrigin.position) < 0.2f)
        {
            if (reelSparksParticle != null) reelSparksParticle.Stop();
            if (lineRenderer != null) lineRenderer.enabled = false;

            currentState = HarpoonState.COOLDOWN;

            // Level 1 cooldown reduction: 1.5s reload
            float cd = isLevelOneOnboarding ? levelOneCooldown : baseCooldown;
            float trickMultiplier = trickSystem != null ? trickSystem.GetHarpoonCooldownMultiplier() : 1.0f;
            currentCooldownTimer = cd * trickMultiplier;

            network?.SendStateUpdate("IDLE");
        }
    }

    public void ForceDismount()
    {
        if (currentState == HarpoonState.ATTACHED)
        {
            if (tetherCable != null) tetherCable.ReleaseTether();
            StartRetraction();
        }
    }

    public HarpoonState GetStateEnum() => currentState;

    public string GetCurrentState()
    {
        switch (currentState)
        {
            case HarpoonState.ATTACHED: return "TOWED";
            case HarpoonState.FLYING:
            case HarpoonState.RETRACTING: return "FIRED";
            default: return "IDLE";
        }
    }

    public float GetRopeTensionNormalized()
    {
        if (currentState == HarpoonState.ATTACHED && tetherCable != null)
        {
            return tetherCable.GetCurrentTension();
        }
        return 0.0f;
    }
}
