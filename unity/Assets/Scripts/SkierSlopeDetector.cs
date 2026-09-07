using UnityEngine;

/// <summary>
/// Continuous terrain surface and ramp takeoff detection.
/// Supplies surface normals directly to SSXTrickSystem for landing evaluation.
/// Casts along global gravity down to support arbitrary aerial flips/spins,
/// with landing bounce debouncing to prevent micro-bump airtime resets.
/// </summary>
public class SkierSlopeDetector : MonoBehaviour
{
    [Header("Sensor Configuration")]
    public float rayLength = 1.4f;
    public float sphereRadius = 0.35f;
    public LayerMask terrainLayerMask;
    public Transform sensorOrigin;

    [Header("Airtime Debounce")]
    public float airborneDebounceThreshold = 0.12f; // Minimum airborne duration before triggering trick mode
    public float landingDebounceThreshold = 0.05f;  // Minimum ground contact duration before declaring landed

    [Header("State")]
    public bool isGrounded = true;
    public Vector3 currentSurfaceNormal = Vector3.up;

    private SSXTrickSystem trickSystem;
    private Rigidbody rb;
    private float ungroundedTimer = 0f;
    private float groundedTimer = 0f;

    void Awake()
    {
        trickSystem = GetComponent<SSXTrickSystem>();
        rb = GetComponent<Rigidbody>();
        if (sensorOrigin == null) sensorOrigin = transform;
    }

    void FixedUpdate()
    {
        CheckGroundState();
    }

    private void CheckGroundState()
    {
        // Invariant: Always cast along GLOBAL gravity DOWN (Vector3.down).
        // Never cast along -transform.up, which points to the sky during backflips/inverts.
        Ray ray = new Ray(sensorOrigin.position, Vector3.down);
        bool hit = Physics.SphereCast(ray, sphereRadius, out RaycastHit hitInfo, rayLength, terrainLayerMask);

        if (hit)
        {
            currentSurfaceNormal = hitInfo.normal;
            ungroundedTimer = 0f;
            groundedTimer += Time.fixedDeltaTime;

            if (!isGrounded && groundedTimer >= landingDebounceThreshold)
            {
                // Landed: Pass ground normal into SSX landing evaluator
                isGrounded = true;
                if (trickSystem != null)
                {
                    trickSystem.OnHitGround(hitInfo.normal);
                }
            }
        }
        else
        {
            groundedTimer = 0f;
            ungroundedTimer += Time.fixedDeltaTime;

            if (isGrounded && ungroundedTimer >= airborneDebounceThreshold)
            {
                // Truly airborne: Left kicker ramp, cliff drop, or terrain lip
                isGrounded = false;
                if (trickSystem != null)
                {
                    trickSystem.OnLeaveGround();
                }
            }
        }
    }

    void OnDrawGizmosSelected()
    {
        Transform origin = sensorOrigin != null ? sensorOrigin : transform;
        Gizmos.color = isGrounded ? Color.green : Color.red;
        Gizmos.DrawWireSphere(origin.position + Vector3.down * rayLength, sphereRadius);
    }
}
