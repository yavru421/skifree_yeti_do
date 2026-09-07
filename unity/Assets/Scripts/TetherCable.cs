using UnityEngine;

/// <summary>
/// High-tension physical steel cable and towing force applicator.
/// Renders cable vibrations and applies damped relative spring forces from the Frost Leviathan to the skier.
/// </summary>
[RequireComponent(typeof(LineRenderer))]
public class TetherCable : MonoBehaviour
{
    [Header("Anchors")]
    public Transform playerAnchor;         // Harpoon reel on player harness
    public Transform targetBeastSegment;   // Active target bone/segment on Frost Leviathan
    
    [Header("Cable Mechanics")]
    public float restLength = 12.0f;       // Slack length before tension engages
    public float springStiffness = 850.0f; // Towing force multiplier
    public float dampening = 45.0f;        // Resistance to snapback oscillation
    public float maxTensionForce = 3500f;  // Maximum pull before cable snap/break
    public float breakDistance = 85.0f;    // Emergency break if player falls too far behind

    [Header("Visual & Audio FX")]
    public int lineSegments = 24;          // Interpolation points for catenary/sagging curve
    public float waveFrequency = 35.0f;    // Vibration frequency under tension
    public float waveAmplitude = 0.25f;    // Cable wobble amplitude
    public ParticleSystem tensionSparks;   // Sparks emitted at anchor reel under heavy strain
    public ParticleSystem snowWakeSpray;   // High-speed snow spray from skis during tow

    private LineRenderer lineRenderer;
    private Rigidbody playerRb;
    private Rigidbody beastRb;
    private bool isTethered = false;
    private float currentTension = 0f;

    void Awake()
    {
        lineRenderer = GetComponent<LineRenderer>();
        lineRenderer.positionCount = lineSegments;
        lineRenderer.enabled = false;
    }

    public void AttachTether(Transform playerHarness, Transform whaleSegment, Rigidbody skierRigidbody)
    {
        playerAnchor = playerHarness;
        targetBeastSegment = whaleSegment;
        playerRb = skierRigidbody;
        beastRb = targetBeastSegment != null ? targetBeastSegment.GetComponentInParent<Rigidbody>() : null;
        isTethered = true;
        lineRenderer.enabled = true;

        if (snowWakeSpray != null && !snowWakeSpray.isPlaying)
            snowWakeSpray.Play();
    }

    public void ReleaseTether()
    {
        isTethered = false;
        lineRenderer.enabled = false;
        currentTension = 0f;

        if (tensionSparks != null) tensionSparks.Stop();
        if (snowWakeSpray != null) snowWakeSpray.Stop();
    }

    void FixedUpdate()
    {
        if (!isTethered || playerAnchor == null || targetBeastSegment == null || playerRb == null)
            return;

        Vector3 delta = targetBeastSegment.position - playerAnchor.position;
        float distance = delta.magnitude;

        // Break condition check
        if (distance > breakDistance)
        {
            SendMessageUpwards("OnTetherSnapped", SendMessageOptions.DontRequireReceiver);
            ReleaseTether();
            return;
        }

        // Apply Damped Spring Physics when stretched beyond rest length
        if (distance > restLength)
        {
            Vector3 tensionDir = delta.normalized;
            float extension = distance - restLength;

            // Compute relative velocity delta against beast to preserve downhill momentum
            Vector3 beastVelocity = beastRb != null ? beastRb.velocity : Vector3.zero;
            Vector3 relativeVelocity = playerRb.velocity - beastVelocity;
            float dampingForce = Vector3.Dot(relativeVelocity, tensionDir) * dampening;

            float forceMagnitude = (extension * springStiffness) - dampingForce;
            forceMagnitude = Mathf.Clamp(forceMagnitude, 0f, maxTensionForce);
            currentTension = forceMagnitude / maxTensionForce;

            Vector3 appliedForce = tensionDir * forceMagnitude;
            playerRb.AddForce(appliedForce, ForceMode.Force);

            // Trigger tension sparks at the harness reel under high stress
            if (tensionSparks != null)
            {
                if (currentTension > 0.65f && !tensionSparks.isPlaying)
                    tensionSparks.Play();
                else if (currentTension <= 0.65f && tensionSparks.isPlaying)
                    tensionSparks.Stop();
            }
        }
        else
        {
            currentTension = 0f;
            if (tensionSparks != null && tensionSparks.isPlaying)
                tensionSparks.Stop();
        }
    }

    void Update()
    {
        if (!isTethered || playerAnchor == null || targetBeastSegment == null)
            return;

        DrawVibratingCable();
    }

    private void DrawVibratingCable()
    {
        Vector3 start = playerAnchor.position;
        Vector3 end = targetBeastSegment.position;

        for (int i = 0; i < lineSegments; i++)
        {
            float t = (float)i / (lineSegments - 1);
            Vector3 point = Vector3.Lerp(start, end, t);

            // Add sine wave vibration modulated by cable tension
            if (currentTension > 0.05f)
            {
                float vibration = Mathf.Sin(t * Mathf.PI * 4f + Time.time * waveFrequency) 
                                * (waveAmplitude * currentTension);
                point += Vector3.up * vibration;
            }
            else
            {
                // Cable sag when slack
                float sag = Mathf.Sin(t * Mathf.PI) * (restLength * 0.08f);
                point -= Vector3.up * sag;
            }

            lineRenderer.SetPosition(i, point);
        }
    }

    public float GetCurrentTension() => currentTension;
    public bool IsTethered() => isTethered;
}
