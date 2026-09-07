using UnityEngine;
using UnityEngine.EventSystems;

public class MobileSwipeController : MonoBehaviour
{
    [Header("Swipe Detection Config")]
    public float minSwipeDistance = 50f;          // Minimum pixel swipe distance to trigger a rotation
    public float maxSwipeTime = 0.5f;             // Maximum duration of a swipe gesture
    
    [Header("Mobile UI Layout References")]
    public RectTransform leftSwipeZone;           // Area designated for tricks
    public RectTransform rightCarveZone;          // Area designated for slaloming/carving
    
    // Cached References
    private SSXTrickSystem trickSystem;
    private HarpoonLauncher harpoonLauncher;

    // Swipe State Tracking (Left Thumb)
    private Vector2 swipeStartPosition;
    private float swipeStartTime;
    private int activeLeftTouchId = -1;

    // Steering State Tracking (Right Thumb)
    private int activeRightTouchId = -1;
    private float carveHorizontalInput = 0f;

    void Awake()
    {
        trickSystem = GetComponent<SSXTrickSystem>();
        harpoonLauncher = GetComponent<HarpoonLauncher>();
    }

    void Update()
    {
        // Process active mobile touches
        for (int i = 0; i < Input.touchCount; i++)
        {
            Touch touch = Input.GetTouch(i);

            // 1. LEFT HAND: Swipe Zone (Tricks, Spins, Flips, Grabs)
            if (IsTouchInZone(touch.position, leftSwipeZone))
            {
                HandleLeftTouch(touch);
            }
            
            // 2. RIGHT HAND: Carving/Steering Slide Zone & Fire Buttons
            if (IsTouchInZone(touch.position, rightCarveZone))
            {
                HandleRightTouch(touch);
            }
        }
    }

    private void HandleLeftTouch(Touch touch)
    {
        switch (touch.phase)
        {
            case TouchPhase.Began:
                activeLeftTouchId = touch.fingerId;
                swipeStartPosition = touch.position;
                swipeStartTime = Time.time;
                break;

            case TouchPhase.Ended:
                if (touch.fingerId == activeLeftTouchId)
                {
                    float swipeDuration = Time.time - swipeStartTime;
                    Vector2 swipeDelta = touch.position - swipeStartPosition;

                    if (swipeDelta.magnitude >= minSwipeDistance && swipeDuration <= maxSwipeTime)
                    {
                        InterpretSwipe(swipeDelta);
                    }
                    else if (swipeDelta.magnitude < minSwipeDistance)
                    {
                        // A quick tap in the trick zone triggers an aerial GRAB
                        TriggerMobileGrab();
                    }
                    activeLeftTouchId = -1;
                }
                break;
                
            case TouchPhase.Canceled:
                if (touch.fingerId == activeLeftTouchId) activeLeftTouchId = -1;
                break;
        }
    }

    private void InterpretSwipe(Vector2 swipeDelta)
    {
        // Ignore gestures if we aren't in mid-air
        if (trickSystem == null || trickSystem.IsGrounded()) return;

        float x = swipeDelta.x;
        float y = swipeDelta.y;

        if (Mathf.Abs(x) > Mathf.Abs(y))
        {
            // Horizontal Swipe: Triggers a horizontal SPIN
            if (x > 0)
                trickSystem.QueueMobileTrick(Vector3.up, 180f); // Right Spin
            else
                trickSystem.QueueMobileTrick(Vector3.up, -180f); // Left Spin
        }
        else
        {
            // Vertical Swipe: Triggers a vertical FLIP
            if (y > 0)
                trickSystem.QueueMobileTrick(Vector3.right, 360f); // Frontflip
            else
                trickSystem.QueueMobileTrick(Vector3.right, -360f); // Backflip
        }
    }

    private void TriggerMobileGrab()
    {
        if (trickSystem != null && !trickSystem.IsGrounded())
        {
            trickSystem.ExecuteMobileGrab(); // Accumulate grab count
        }
    }

    private void HandleRightTouch(Touch touch)
    {
        // Simple virtual thumbstick on the right side of the screen for carving/steering
        if (touch.phase == TouchPhase.Began || touch.phase == TouchPhase.Moved || touch.phase == TouchPhase.Stationary)
        {
            activeRightTouchId = touch.fingerId;
            
            // Map horizontal displacement to steering angle
            Vector2 zoneCenter = rightCarveZone.position;
            float normalizedX = (touch.position.x - zoneCenter.x) / (rightCarveZone.rect.width / 2);
            carveHorizontalInput = Mathf.Clamp(normalizedX, -1f, 1f);
        }
        else if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
        {
            if (touch.fingerId == activeRightTouchId)
            {
                carveHorizontalInput = 0f;
                activeRightTouchId = -1;
            }
        }
    }

    // Public getter for the player's movement controller to read carving inputs
    public float GetCarveInput()
    {
        return carveHorizontalInput;
    }

    // Helper to evaluate touch coordinates within canvas anchors
    private bool IsTouchInZone(Vector2 touchPos, RectTransform zone)
    {
        if (zone == null) return false;
        return RectTransformUtility.RectangleContainsScreenPoint(zone, touchPos);
    }

    // Direct interface hook for the visual On-Screen "Harpoon Fire" Button
    public void OnMobileHarpoonButtonTapped()
    {
        if (harpoonLauncher != null)
        {
            harpoonLauncher.TriggerMobileLaunch();
        }
    }
}
