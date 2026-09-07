using UnityEngine;
using System;

/// <summary>
/// SSX 3 Client-Side Physics & Trick Handler for Frost Leviathan: Harpoon Hunt.
/// Tracks airborne spins, flips, grabs, boost meter, landing evaluation, and harpoon cooldown reduction.
/// Supports both keyboard inputs and mobile swipe/tap gesture hooks.
/// </summary>
public class SSXTrickSystem : MonoBehaviour
{
    [Header("Trick Settings")]
    public float minAirTimeForTrick = 0.4f;      // Minimum jump time to qualify for tricks
    public float perfectLandingThreshold = 15f;   // Maximum angle offset (degrees) for a perfect landing
    public float sketchyLandingThreshold = 45f;   // Maximum angle offset for a shaky landing (points reduced)
    
    [Header("Boost & Cooldowns")]
    public float currentBoost = 0f;               // Ranges from 0 to 100
    public float boostDeclineRate = 5f;           // Boost lost per second when not actively boosting
    public float superBoostThreshold = 100f;      // Max boost capacity
    
    // Actions to bind UI and other gameplay systems
    public static event Action<string, int> OnTrickCompleted; // Sends (Trick Name, Points Awarded)
    public static event Action OnWipeout;                     // Triggered when landing is failed
    public static event Action<float> OnBoostMeterChanged;     // For UI slider updating (0.0 to 1.0)
    public static event Action<float> OnComboMultiplierChanged; // For HTML/Mobile HUD overlay updates

    // Internal Physics & Rotational Tracking
    private bool isGrounded = true;
    private float airTimeCounter = 0f;
    private Quaternion jumpStartRotation;
    private Vector3 totalRotationAccumulated = Vector3.zero;
    private Vector3 lastEulerAngles;
    
    // Active trick tracking in the current jump
    private int spinDegrees = 0;
    private int flipDegrees = 0;
    private int grabCount = 0;
    private bool hasWipedOutThisJump = false;
    private float currentComboMultiplier = 1.0f;

    // External Reference Hooks
    private Rigidbody rb;
    private HunterConnection networkConnection;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
        networkConnection = GetComponent<HunterConnection>();
    }

    void Update()
    {
        // 1. Process Boost Consumption
        if (currentBoost > 0 && isGrounded)
        {
            currentBoost -= boostDeclineRate * Time.deltaTime;
            currentBoost = Mathf.Clamp(currentBoost, 0f, superBoostThreshold);
            OnBoostMeterChanged?.Invoke(currentBoost / superBoostThreshold);
        }

        // 2. Track Air Tricks
        if (!isGrounded)
        {
            airTimeCounter += Time.deltaTime;
            TrackAirborneRotations();
            DetectGrabInputs();
        }
    }

    /// <summary>
    /// Tracks rotational delta frame-by-frame to calculate cumulative spins/flips.
    /// </summary>
    private void TrackAirborneRotations()
    {
        Vector3 currentEuler = transform.eulerAngles;
        
        float deltaY = Mathf.DeltaAngle(lastEulerAngles.y, currentEuler.y);
        float deltaX = Mathf.DeltaAngle(lastEulerAngles.x, currentEuler.x);

        totalRotationAccumulated.y += Mathf.Abs(deltaY); // Y-axis rotation (Spins)
        totalRotationAccumulated.x += Mathf.Abs(deltaX); // X-axis rotation (Flips)

        lastEulerAngles = currentEuler;

        spinDegrees = Mathf.RoundToInt(totalRotationAccumulated.y);
        flipDegrees = Mathf.RoundToInt(totalRotationAccumulated.x);

        UpdateDynamicComboMultiplier();
    }

    /// <summary>
    /// Checks for desktop keyboard button grabs (Shift, Ctrl, Alt).
    /// </summary>
    private void DetectGrabInputs()
    {
        if (Input.GetKeyDown(KeyCode.LeftShift) || Input.GetKeyDown(KeyCode.LeftControl))
        {
            ExecuteMobileGrab();
        }
    }

    #region Mobile Controller Integration Hooks

    public bool IsGrounded() => isGrounded;

    /// <summary>
    /// Enqueues physical torque/rotations from MobileSwipeController gestures.
    /// </summary>
    public void QueueMobileTrick(Vector3 rotationAxis, float targetDegrees)
    {
        if (isGrounded) return;

        if (rb != null)
        {
            float torqueForce = (targetDegrees / 180f) * 12.0f;
            rb.AddTorque(transform.TransformDirection(rotationAxis) * torqueForce, ForceMode.Impulse);
        }

        if (rotationAxis == Vector3.up)
            totalRotationAccumulated.y += Mathf.Abs(targetDegrees);
        else if (rotationAxis == Vector3.right)
            totalRotationAccumulated.x += Mathf.Abs(targetDegrees);

        spinDegrees = Mathf.RoundToInt(totalRotationAccumulated.y);
        flipDegrees = Mathf.RoundToInt(totalRotationAccumulated.x);

        UpdateDynamicComboMultiplier();
    }

    /// <summary>
    /// Increments grab count from touch tap in mobile trick zone.
    /// </summary>
    public void ExecuteMobileGrab()
    {
        grabCount++;
        PlayVisualTrickFlash();
        UpdateDynamicComboMultiplier();
    }

    private void UpdateDynamicComboMultiplier()
    {
        int trickCount = (spinDegrees / 180) + (flipDegrees / 360) + grabCount;
        if (trickCount >= 5) currentComboMultiplier = 3.0f;
        else if (trickCount >= 3) currentComboMultiplier = 2.0f;
        else if (trickCount >= 1) currentComboMultiplier = 1.5f;
        else currentComboMultiplier = 1.0f;

        OnComboMultiplierChanged?.Invoke(currentComboMultiplier);
    }

    #endregion

    /// <summary>
    /// Called by the terrain physics controller when hitting the ground.
    /// </summary>
    public void OnHitGround(Vector3 terrainNormal)
    {
        if (isGrounded) return;
        isGrounded = true;

        if (airTimeCounter >= minAirTimeForTrick)
        {
            EvaluateLanding(terrainNormal);
        }
        else
        {
            ResetAirTracking();
        }
    }

    /// <summary>
    /// Triggered when leaving a kicker ramp, a halfpipe lip, or falling off a ledge.
    /// </summary>
    public void OnLeaveGround()
    {
        if (!isGrounded) return;
        isGrounded = false;
        
        airTimeCounter = 0f;
        jumpStartRotation = transform.rotation;
        lastEulerAngles = transform.eulerAngles;
        totalRotationAccumulated = Vector3.zero;
        
        spinDegrees = 0;
        flipDegrees = 0;
        grabCount = 0;
        hasWipedOutThisJump = false;
        currentComboMultiplier = 1.0f;
        OnComboMultiplierChanged?.Invoke(1.0f);
    }

    /// <summary>
    /// SSX-Style Landing Check: Evaluates alignment relative to terrain angle and rewards player.
    /// </summary>
    private void EvaluateLanding(Vector3 terrainNormal)
    {
        Vector3 playerUp = transform.up;
        float landingAngleOffset = Vector3.Angle(playerUp, terrainNormal);

        if (landingAngleOffset > sketchyLandingThreshold)
        {
            TriggerWipeout();
        }
        else
        {
            bool isPerfect = landingAngleOffset <= perfectLandingThreshold;
            ProcessTrickRewards(isPerfect);
        }

        ResetAirTracking();
    }

    private void ProcessTrickRewards(bool perfectLanding)
    {
        int spinPoints = (spinDegrees / 180) * 500;
        int flipPoints = (flipDegrees / 360) * 1200;
        int grabPoints = grabCount * 300;

        int totalPoints = spinPoints + flipPoints + grabPoints;
        
        if (totalPoints == 0 && airTimeCounter > 1.0f)
        {
            totalPoints = 200;
        }

        if (totalPoints > 0)
        {
            string trickName = BuildTrickString();
            
            if (perfectLanding)
            {
                totalPoints = Mathf.RoundToInt(totalPoints * 1.5f * currentComboMultiplier);
                trickName = "PERFECT " + trickName;
                AwardBoost(totalPoints * 0.05f);
            }
            else
            {
                totalPoints = Mathf.RoundToInt(totalPoints * 0.8f * currentComboMultiplier);
                trickName = "SKETCHY " + trickName;
                AwardBoost(totalPoints * 0.02f);
            }

            OnTrickCompleted?.Invoke(trickName, totalPoints);
        }
    }

    private void TriggerWipeout()
    {
        hasWipedOutThisJump = true;
        currentBoost = 0f;
        currentComboMultiplier = 1.0f;
        OnWipeout?.Invoke();
        OnBoostMeterChanged?.Invoke(0f);
        OnComboMultiplierChanged?.Invoke(1.0f);
        
        if (rb != null)
        {
            rb.velocity *= 0.1f; 
        }
    }

    private string BuildTrickString()
    {
        string rotationString = "";
        if (spinDegrees >= 360) rotationString = $"{(spinDegrees / 360) * 360} SPIN ";
        if (flipDegrees >= 360) rotationString += "BACKFLIP ";

        string grabString = grabCount > 0 ? $"x{grabCount} GRAB" : "";
        string finalString = $"{rotationString}{grabString}".Trim();

        return string.IsNullOrEmpty(finalString) ? "BIG AIR" : finalString;
    }

    private void AwardBoost(float amount)
    {
        currentBoost = Mathf.Clamp(currentBoost + amount, 0f, superBoostThreshold);
        OnBoostMeterChanged?.Invoke(currentBoost / superBoostThreshold);
    }

    private void ResetAirTracking()
    {
        airTimeCounter = 0f;
    }

    private void PlayVisualTrickFlash()
    {
    }

    public float GetHarpoonCooldownMultiplier()
    {
        return currentBoost >= (superBoostThreshold * 0.8f) ? 0.6f : 1.0f;
    }
}
