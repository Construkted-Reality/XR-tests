let gl = null;
let xrButton = null;
let xrImmersiveRefSpace = null;
let inlineViewerHelper = null;

function onRequestSession() {
  // Requests an 'immersive-ar' session, which ensures that the users
  // environment will be visible either via video passthrough or a
  // transparent display. This may be presented either in a headset or
  // fullscreen on a mobile device.
  let uiElement = document.getElementById("overlay-content"); //ui
  return navigator.xr
    .requestSession("immersive-ar", {
      optionalFeatures: ["dom-overlay", "dom-overlay-for-handheld-ar"],
      domOverlay: { root: uiElement },
    })
    .then((session) => {
      xrButton.setSession(session);
      session.isImmersive = true;
      onSessionStarted(session);
    });
}

function onEndSession(session) {
  session.end();
}

// Creates a WebGL context and initializes it with some common default state.
function createWebGLContext(glAttribs) {
  glAttribs = glAttribs || { alpha: false };

  let webglCanvas = document.getElementById("xr-canvas");
  let contextTypes = glAttribs.webgl2
    ? ["webgl2"]
    : ["webgl", "experimental-webgl"];
  let context = null;

  for (let contextType of contextTypes) {
    context = webglCanvas.getContext(contextType, glAttribs);
    if (context) {
      break;
    }
  }

  if (!context) {
    let webglType = glAttribs.webgl2 ? "WebGL 2" : "WebGL";
    console.error("This browser does not support " + webglType + ".");
    return null;
  }

  return context;
}

function initGL() {
  gl = createWebGLContext({
    xrCompatible: true,
  });
}

function onSessionStarted(session) {
  session.addEventListener("end", onSessionEnded);

  if (session.isImmersive) {

  }

  initGL();

  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

  let refSpaceType = session.isImmersive ? "local" : "viewer";

  session.requestReferenceSpace(refSpaceType).then((refSpace) => {
    if (session.isImmersive) {
      xrImmersiveRefSpace = refSpace;
    } else {
      inlineViewerHelper = new CONSTRUKTEDXR.InlineViewerHelper(gl.canvas, refSpace);
    }
    session.requestAnimationFrame(onXRFrame);
  });
}

function onSessionEnded(event) {
  if (event.session.isImmersive) {
    xrButton.setSession(null);
    // Turn the background back on when we go back to the inlive view.
  }
}

function initXR() {
  xrButton = new CONSTRUKTEDXR.WebXRButton({
    onRequestSession: onRequestSession,
    onEndSession: onEndSession,
    textEnterXRTitle: "START AR",
    textXRNotFoundTitle: "AR NOT FOUND",
    textExitXRTitle: "EXIT  AR",
  });

  document.querySelector("header").appendChild(xrButton.domElement);

  if (navigator.xr) {
    // Checks to ensure that 'immersive-ar' mode is available, and only
    // enables the button if so.
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      xrButton.enabled = supported;
    });

    navigator.xr.requestSession("inline").then(onSessionStarted);
  }
}

function onXRFrame(t, frame) {
  let session = frame.session;
  let refSpace = session.isImmersive
    ? xrImmersiveRefSpace
    : inlineViewerHelper.referenceSpace;
  let pose = frame.getViewerPose(refSpace);

  if (pose) {
    let headEuler = CONSTRUKTEDXR.create$1();
    let or = pose.transform.orientation;
      CONSTRUKTEDXR.eulerFromQuaternionDegree(headEuler, [or.x, or.y, or.z, or.w], "YXZ");

    const event = new CustomEvent("viewerPoseUpdatedEvent", {
      detail: {
        posX: pose.transform.position.x,
        posY: pose.transform.position.y,
        posZ: pose.transform.position.z,
        rotX: -headEuler[1],
        rotY: headEuler[0],
        rotZ: headEuler[2],
      },
    });

    customEventTarget.dispatchEvent(event);
  }

  session.requestAnimationFrame(onXRFrame);

  // Assumed to be a XRWebGLLayer for now.
  let layer = session.renderState.baseLayer;

  gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
}

const customEventTarget = document.querySelector(".customEventTarget");

function init() {
    //cache UI objects

    function fixedSize_JS(value, size) {
        return value.padStart(size).substring(0, size);
    }

    const posXElement = document.getElementById("posX");
    const posYElement = document.getElementById("posY");
    const posZElement = document.getElementById("posZ");

    const rotXElement = document.getElementById("rotX");
    const rotYElement = document.getElementById("rotY");
    const rotZElement = document.getElementById("rotZ");

    customEventTarget.addEventListener("viewerPoseUpdatedEvent", function (e) {
        // Update Position:
        posXElement.innerHTML = "x: " + fixedSize_JS(e.detail.posX.toFixed(3), 6);
        posYElement.innerHTML = "y: " + fixedSize_JS(e.detail.posY.toFixed(3), 6);
        posZElement.innerHTML = "z: " + fixedSize_JS(e.detail.posZ.toFixed(3), 6);

        //Update Rotation:
        rotXElement.innerHTML =
            "x: " + fixedSize_JS(Math.floor(e.detail.rotX).toString(), 4) + "&#176;";
        rotYElement.innerHTML =
            "y: " + fixedSize_JS(Math.floor(e.detail.rotY).toString(), 4) + "&#176;";
        rotZElement.innerHTML =
            "z: " + fixedSize_JS(Math.floor(e.detail.rotZ).toString(), 4) + "&#176;";
    });
}

init();
initXR();
