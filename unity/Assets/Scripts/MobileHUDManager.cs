using UnityEngine;
using System.Runtime.InteropServices;

public class MobileHUDManager : MonoBehaviour
{
    // JavaScript Plugin Hooks (Allows Unity WebGL to send updates back to browser HTML HUD)
    #if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void UpdateHTMLTension(float normalizedTension);

    [DllImport("__Internal")]
    private static extern void UpdateHTMLCombo(float multiplier);
    #else
    // Fallback stub logs for Unity Editor debugging
    private void UpdateHTMLTension(float normalizedTension) { }
    private void UpdateHTMLCombo(float multiplier) { }
    #endif

    [Header("Controller Component Hooks")]
    private SSXTrickSystem trickSystem;
    private HarpoonLauncher harpoonLauncher;
    private float currentCarveInput = 0f;

    void Awake()
    {
        trickSystem = GetComponent<SSXTrickSystem>();
        harpoonLauncher = GetComponent<HarpoonLauncher>();
    }

    void Start()
    {
        // Subscribe to game physics events to synchronize HTML overlay indicators
        SSXTrickSystem.OnComboMultiplierChanged += HandleComboChanged;
    }

    void OnDestroy()
    {
        SSXTrickSystem.OnComboMultiplierChanged -= HandleComboChanged;
    }

    void Update()
    {
        // Read rope tension continuously from active HarpoonLauncher states
        if (harpoonLauncher != null && harpoonLauncher.GetCurrentState() == "TOWED")
        {
            float normalizedTension = harpoonLauncher.GetRopeTensionNormalized();
            UpdateHTMLTension(normalizedTension);
        }
        else
        {
            UpdateHTMLTension(0.0f);
        }
    }

    // =========================================================================
    // JS -> UNITY MESSAGE RECEIVERS
    // These match the SendMessage hooks wired into index.html
    // =========================================================================

    /// <summary>
    /// Triggered when the mobile user taps the designated 'HARPOON FIRE' overlay.
    /// </summary>
    public void OnMobileHarpoonButtonTapped()
    {
        if (harpoonLauncher != null)
        {
            harpoonLauncher.TriggerMobileLaunch();
        }
    }

    /// <summary>
    /// Updated when the mobile user slides the right thumb 'CARVE SLALOM' element.
    /// </summary>
    /// <param name="normalizedCarve">Range -1.0 (hard left carving) to 1.0 (hard right carving)</param>
    public void UpdateMobileCarveInput(float normalizedCarve)
    {
        currentCarveInput = normalizedCarve;
    }

    /// <summary>
    /// Parsed when a valid swipe gesture is evaluated on the left-side touch screen.
    /// </summary>
    /// <param name="jsonPayload">The JSON-serialized trick object containing gesture vectors</param>
    public void OnMobileSwipeTrickReceived(string jsonPayload)
    {
        if (trickSystem == null) return;

        // Simple lightweight struct for WebGL deserialization
        MobileTrickData data = JsonUtility.FromJson<MobileTrickData>(jsonPayload);

        if (data.type == "SPIN")
        {
            // Swipe Left/Right triggers 180 spin degrees
            trickSystem.QueueMobileTrick(Vector3.up, data.val);
        }
        else if (data.type == "FLIP")
        {
            // Swipe Down/Up triggers a full 360 degree backflip/frontflip
            trickSystem.QueueMobileTrick(Vector3.right, data.val);
        }
        else if (data.type == "GRAB")
        {
            // Rapid tap triggers a localized board grab
            trickSystem.ExecuteMobileGrab();
        }
    }

    /// <summary>
    /// Public getter for the main player movement physics script.
    /// Replaces keyboard 'Horizontal' inputs with mobile-specific carving slider data.
    /// </summary>
    public float GetMobileHorizontalInput()
    {
        // Fallback to keyboard inputs in Editor, otherwise yield mobile slider input
        #if UNITY_EDITOR
        float keyboardInput = Input.GetAxisRaw("Horizontal");
        return Mathf.Approximately(keyboardInput, 0f) ? currentCarveInput : keyboardInput;
        #else
        return currentCarveInput;
        #endif
    }

    private void HandleComboChanged(float multiplier)
    {
        // Flush multiplier update up to the browser HTML elements
        UpdateHTMLCombo(multiplier);
    }

    [System.Serializable]
    private struct MobileTrickData
    {
        public string type;
        public float val;
    }
}
