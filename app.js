window.isMobile = function () {
  let check = false;

  (function (a) {
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
        a
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
        a.substr(0, 4)
      )
    )
      check = true;
  })(navigator.userAgent || navigator.vendor || window.opera);

  return check;
};

import { WebXRButton } from "./js/util/webxr-button.js";
import { InlineViewerHelper } from "./js/util/inline-viewer-helper.js";
import { eulerFromQuaternionDegree, create$1 } from "./js/util/math.js";
import WebXRPolyfill from "./js/util/webxr-polyfill.js";

let polyfill = new WebXRPolyfill();
let gl = null;
let xrButton = null;
let xrImmersiveRefSpace = null;
let inlineViewerHelper = null;
let cesiumFPVCameraController;
const mobile = isMobile();

let construktedAssetSlug = null;
//const tileSeverUrl = 'https://assets01.construkted.com/index.php/asset';

function init() {
  const url = window.location.href;

  const tokens = url.split("/");

  construktedAssetSlug = tokens.pop();

  if (construktedAssetSlug === "") {
    hideLoading();
    return;
  }

  //let tilesetURL = tileSeverUrl + '/' + construktedAssetSlug + '/tileset.json';
  let tilesetURL =
    "https://s3.us-east-2.wasabisys.com/construkted-assets/" +
    construktedAssetSlug +
    "/tileset.json";

  Cesium.Resource.fetchJson({ url: tilesetURL })
    .then(function (json) {
      hideLoading();

      document.querySelector("#welcome").style.display = "none";
      document.querySelector("#cesiumContainer").style.display = "block";
      document.querySelector("#toolbar").style.display = "block";

      main();
    })
    .otherwise(function (err) {
      hideLoading();

      setTimeout(function () {
        alert("Asset : " + construktedAssetSlug + " does not exist!");
      }, 100);
    });
}

function hideLoading() {
  document.querySelector("#loading").style.display = "none";
}

function addDebugUI() {
  let model = {
    transX: 0,
    transY: 0,
    transZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };

  let transX = 0,
    transY = 0,
    transZ = 0,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0;

  Cesium.knockout.track(model);

  let toolbar = document.getElementById("toolbar");

  Cesium.knockout.applyBindings(model, toolbar);

  Cesium.knockout.getObservable(model, "transX").subscribe(updateTransX);

  function updateTransX(value) {
    transX = parseFloat(value);

    changeCesiumCamera(transX, transY, transZ, rotationX, rotationY, rotationZ);
  }

  Cesium.knockout.getObservable(model, "transY").subscribe(updateTransY);

  function updateTransY(value) {
    transY = parseFloat(value);

    changeCesiumCamera(transX, transY, transZ, rotationX, rotationY, rotationZ);
  }

  Cesium.knockout.getObservable(model, "transZ").subscribe(updateTransZ);

  function updateTransZ(value) {
    transZ = parseFloat(value);

    changeCesiumCamera(transX, transY, transZ, rotationX, rotationY, rotationZ);
  }

  Cesium.knockout.getObservable(model, "rotationX").subscribe(updateRotationX);

  function updateRotationX(value) {
    rotationX = parseFloat(value);

    changeCesiumCamera(transX, transY, transZ, rotationX, rotationY, rotationZ);
  }

  Cesium.knockout.getObservable(model, "rotationY").subscribe(updateRotationY);

  function updateRotationY(value) {
    rotationY = parseFloat(value);

    changeCesiumCamera(transX, transY, transZ, rotationX, rotationY, rotationZ);
  }

  Cesium.knockout.getObservable(model, "rotationZ").subscribe(updateRotationZ);

  function updateRotationZ(value) {
    rotationZ = parseFloat(value);

    changeCesiumCamera(transX, transY, transZ, rotationX, rotationY, rotationZ);
  }
}

function main() {
  Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2MzJlNDI2ZC1hMmE5LTQ4MjEtYmQwYS1iMDRlNTNjM2JiZTkiLCJpZCI6MjkyMSwiaWF0IjoxNTM1MjE4Mjk1fQ.jMg72t7Gnkk4-E9G7zhd_CoTJBUJ39hHALmxGBRL1ok";

  let viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    homeButton: false, //  the HomeButton widget will not be created.
    baseLayerPicker: false, // If set to false, the BaseLayerPicker widget will not be created.
    geocoder: false,
    sceneModePicker: false,
    timeline: false,
    fullscreenElement: "cesiumContainer",
    requestRenderMode: true,
  });

  //let tilesetURL = tileSeverUrl + '/' + construktedAssetSlug + '/tileset.json';
  let tilesetURL =
    "https://s3.us-east-2.wasabisys.com/construkted-assets/" +
    construktedAssetSlug +
    "/tileset.json";

  const tileset = viewer.scene.primitives.add(
    new Cesium.Cesium3DTileset({
      url: tilesetURL,
      immediatelyLoadDesiredLevelOfDetail: true,
      skipLevelOfDetail: true,
      loadSiblings: true,
    })
  );

  viewer.zoomTo(tileset);

  tileset.readyPromise
    .then(function () {
      if (tileset.asset.extras != null) {
        if (tileset.asset.extras.ion.georeferenced !== true) {
          tileset.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
            Cesium.Cartesian3.fromDegrees(0, 0)
          );
        }
      }

      const options = {
        cesiumViewer: viewer,
        main3dTileset: tileset,
        isMobile: mobile,
        ignoreCollisionDetection: true,
      };

      cesiumFPVCameraController = new CesiumFVPCameraController(options);

      if (!mobile) {
        addDebugUI();
        let exitFPVButton = document.querySelector("#exitFPVModeButton");
        let moveLeftButton = document.querySelector("#moveLeftButton");
        let moveRightButton = document.querySelector("#moveRightButton");
        let moveFrontButton = document.querySelector("#moveFrontButton");
        let moveBackButton = document.querySelector("#moveBackButton");

        cesiumFPVCameraController.FPVStarted().addEventListener(function () {
          exitFPVButton.style.display = "block";
          moveLeftButton.style.display = "block";
          moveRightButton.style.display = "block";
          moveFrontButton.style.display = "block";
          moveBackButton.style.display = "block";

          if (!mobile)
            document.querySelector("#debug-ui").style.display = "block";
        });

        cesiumFPVCameraController.FPVFinished().addEventListener(function () {
          exitFPVButton.style.display = "none";
          moveLeftButton.style.display = "none";
          moveRightButton.style.display = "none";
          moveFrontButton.style.display = "none";
          moveBackButton.style.display = "none";
          document.querySelector("#debug-ui").style.display = "none";
        });

        exitFPVButton.addEventListener("click", function () {
          cesiumFPVCameraController.exitFPV();
        });

        moveLeftButton.addEventListener("mousedown", function () {
          cesiumFPVCameraController.setDirectionLeft();
        });

        moveLeftButton.addEventListener("mouseup", function () {
          cesiumFPVCameraController.setDirectionNone();
        });

        moveRightButton.addEventListener("mousedown", function () {
          cesiumFPVCameraController.setDirectionRight();
        });

        moveRightButton.addEventListener("mouseup", function () {
          cesiumFPVCameraController.setDirectionNone();
        });

        moveFrontButton.addEventListener("mousedown", function () {
          cesiumFPVCameraController.setDirectionForward();
        });

        moveFrontButton.addEventListener("mouseup", function () {
          cesiumFPVCameraController.setDirectionNone();
        });

        moveBackButton.addEventListener("mousedown", function () {
          cesiumFPVCameraController.setDirectionBackward();
        });

        moveBackButton.addEventListener("mouseup", function () {
          cesiumFPVCameraController.setDirectionNone();
        });
      }
    })
    .otherwise(function (error) {
      window.alert(error);
    });
}

let sensitivity = 1;

function changeCesiumCamera(
  translationX,
  translationY,
  translationZ,
  rotationX,
  rotationY,
  rotationZ
) {
  if (!cesiumFPVCameraController) return;

  if (!cesiumFPVCameraController.isEnabled()) return;

  cesiumFPVCameraController.setView(
    translationX * sensitivity,
    translationY * sensitivity,
    translationZ * sensitivity,
    rotationX,
    rotationY,
    rotationZ
  );
}

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

  cesiumFPVCameraController.setAllowStartPositionTap(true);
  cesiumFPVCameraController.exitFPV();
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
    if (cesiumFPVCameraController.startFPVPositionMobile() == null) {
      alert("Please tap on 3d tile to start FPV!");
      cesiumFPVCameraController.setAllowStartPositionTap(true);
      return;
    } else {
      cesiumFPVCameraController.startFPVMobile();
    }
  }

  initGL();

  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

  let refSpaceType = session.isImmersive ? "local" : "viewer";

  session.requestReferenceSpace(refSpaceType).then((refSpace) => {
    if (session.isImmersive) {
      xrImmersiveRefSpace = refSpace;
    } else {
      inlineViewerHelper = new InlineViewerHelper(gl.canvas, refSpace);
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
  xrButton = new WebXRButton({
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
    let headEuler = create$1();
    let or = pose.transform.orientation;
    eulerFromQuaternionDegree(headEuler, [or.x, or.y, or.z, or.w], "YXZ");

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

    // customEventTarget.dispatchEvent(event);

    if (mobile)
      changeCesiumCamera(
        pose.transform.position.x,
        pose.transform.position.y,
        pose.transform.position.z,
        -headEuler[1],
        headEuler[0],
        headEuler[2]
      );
  }

  session.requestAnimationFrame(onXRFrame);

  // Assumed to be a XRWebGLLayer for now.
  let layer = session.renderState.baseLayer;

  gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
}

// function fixedSize_JS(value, size) {
//   return value.padStart(size).substring(0, size);
// }

// cache UI objects
// const posXElement = document.getElementById("posX");
// const posYElement = document.getElementById("posY");
// const posZElement = document.getElementById("posZ");

// const rotXElement = document.getElementById("rotX");
// const rotYElement = document.getElementById("rotY");
// const rotZElement = document.getElementById("rotZ");

// const customEventTarget = document.querySelector(".customEventTarget");

// customEventTarget.addEventListener("viewerPoseUpdatedEvent", function (e) {
//   // Update Position:
//   posXElement.innerHTML = "x: " + fixedSize_JS(e.detail.posX.toFixed(3), 6);
//   posYElement.innerHTML = "y: " + fixedSize_JS(e.detail.posY.toFixed(3), 6);
//   posZElement.innerHTML = "z: " + fixedSize_JS(e.detail.posZ.toFixed(3), 6);

//   //Update Rotation:
//   rotXElement.innerHTML =
//     "x: " + fixedSize_JS(Math.floor(e.detail.rotX).toString(), 4) + "&#176;";
//   rotYElement.innerHTML =
//     "y: " + fixedSize_JS(Math.floor(e.detail.rotY).toString(), 4) + "&#176;";
//   rotZElement.innerHTML =
//     "z: " + fixedSize_JS(Math.floor(e.detail.rotZ).toString(), 4) + "&#176;";
// });

init();
initXR();
