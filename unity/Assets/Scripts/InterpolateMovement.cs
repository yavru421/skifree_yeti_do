using UnityEngine;

/// <summary>
/// Smooths physics and transform interpolation for remote hunters and Frost-Whale segments
/// between 10Hz authoritative server batches down to a fluid, 60+ FPS cinematic action experience.
/// </summary>
public class InterpolateMovement : MonoBehaviour
{
    [Header("Interpolation Targets")]
    public Vector3 endPosition;
    public Quaternion endRotation;

    [Header("Smoothing Configuration")]
    [Tooltip("Time in seconds to smooth translation toward network target")]
    public float positionSmoothTime = 0.15f;

    [Tooltip("Time in seconds to smooth angular rotation toward network target")]
    public float rotationSmoothTime = 0.10f;

    private Vector3 posVelocity = Vector3.zero;
    private float rotVelocity = 0.0f;

    void Start()
    {
        endPosition = transform.position;
        endRotation = transform.rotation;
    }

    void Update()
    {
        // Smoothly slide remote entities from where they are to their network target
        transform.position = Vector3.SmoothDamp(transform.position, endPosition, ref posVelocity, positionSmoothTime);

        // Angular spherical damping for smooth turning
        float angleDelta = Quaternion.Angle(transform.rotation, endRotation);
        if (angleDelta > 0.001f)
        {
            float t = Mathf.SmoothDampAngle(angleDelta, 0.0f, ref rotVelocity, rotationSmoothTime);
            t = 1.0f - (t / angleDelta);
            transform.rotation = Quaternion.Slerp(transform.rotation, endRotation, Mathf.Clamp01(t));
        }
    }
}
