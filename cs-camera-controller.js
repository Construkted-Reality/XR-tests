"use strict";

const CesiumFVPCameraController = (function () {
  // this mean person is stop
  const DIRECTION_NONE = -1;

  const DIRECTION_FORWARD = 0;
  const DIRECTION_BACKWARD = 1;
  const DIRECTION_LEFT = 2;
  const DIRECTION_RIGHT = 3;

  const DEFAULT_HUMAN_WALKING_SPEED = 0.5;

  const MAX_PITCH_IN_DEGREE = 88;
  const ROTATE_SPEED = -5;
  const COLLISION_RAY_HEIGHT = 0.5;
  const HUMAN_EYE_HEIGHT = 1.65;

  //constructor
  function CesiumFVPCameraController(options) {
    this._isMobile = options.isMobile;
    this._enabled = false;
    this._FPVStarted = new Cesium.Event();
    this._FPVFinished = new Cesium.Event();

    this._cesiumViewer = options.cesiumViewer;
    this._canvas = this._cesiumViewer.canvas;
    this._camera = this._cesiumViewer.camera;

    this._direction = DIRECTION_NONE;

    this._main3dTileset = options.main3dTileset;
    this._defaultCameraPositionOrientationJson =
      options.defaultCameraPositionOrientationJson;
    this._ignoreCollisionDetection = Cesium.defined(
      options.ignoreCollisionDetection
    )
      ? options.ignoreCollisionDetection
      : false;

    /**
     * heading: angle with up direction
     * pitch:   angle with right direction
     * roll:    angle with look at direction
     */

    // indicate if heading and pitch is changed
    this._isMouseLeftButtonPressed = false;

    this._startMousePosition = null;
    this._mousePosition = null;

    this._frameMonitor = Cesium.FrameRateMonitor.fromScene(
      this._cesiumViewer.scene
    );

    this._screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(
      this._canvas
    );
    this._screenSpaceEventHandler.setInputAction(
      this._onMouseLButtonDoubleClicked.bind(this),
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
    this._screenSpaceEventHandler.setInputAction(
      this._onMouseLButtonClicked.bind(this),
      Cesium.ScreenSpaceEventType.LEFT_DOWN
    );
    this._screenSpaceEventHandler.setInputAction(
      this._onMouseUp.bind(this),
      Cesium.ScreenSpaceEventType.LEFT_UP
    );

    this._startFPVPositionMobile = null;
    this._lastTranslationX = 0;
    this._lastTranslationY = 0;
    this._lastTranslationZ = 0;

    this._lastRotationX = 0;
    this._lastRotationY = 0;
    this._lastRotaionZ = 0;

    this._allowStartPositionTap = true; //false;
  }

  CesiumFVPCameraController.prototype.setAllowStartPositionTap = function (
    value
  ) {
    this._allowStartPositionTap = value;
  };

  CesiumFVPCameraController.prototype._connectEventHandlers = function () {
    const canvas = this._cesiumViewer.canvas;

    this._screenSpaceEventHandler.setInputAction(
      this._onMouseMove.bind(this),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );

    // needed to put focus on the canvas
    canvas.setAttribute("tabindex", "0");

    canvas.onclick = function () {
      canvas.focus();
    };

    const self = this;

    this._onKeyDownCallback = function (event) {
      self._onKeyDown(event);
    };

    this._onKeyUpCallback = function (event) {
      self._onKeyUp(event);
    };

    document.addEventListener("keydown", this._onKeyDownCallback);
    document.addEventListener("keyup", this._onKeyUpCallback);

    this._disconectOnClockTick = this._cesiumViewer.clock.onTick.addEventListener(
      CesiumFVPCameraController.prototype._onClockTick,
      this
    );
  };

  CesiumFVPCameraController.prototype._disconnectEventHandlers = function () {
    this._screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );

    document.removeEventListener("keydown", this._onKeyDownCallback);
    document.removeEventListener("keyup", this._onKeyUpCallback);
    this._disconectOnClockTick();
  };

  CesiumFVPCameraController.prototype._doStartFPV = function (cartographic) {
    const globe = this._cesiumViewer.scene.globe;
    const self = this;

    this._camera.flyTo({
      destination: globe.ellipsoid.cartographicToCartesian(cartographic),
      orientation: {
        heading: this._camera.heading,
        pitch: 0,
        roll: 0.0,
      },
      complete: function () {
        self._disableDefaultScreenSpaceCameraController();
        self._connectEventHandlers();

        // please note the clone 's meaning.
        self._cameraDirectionAtArStartedMoment = self._camera.direction.clone();
        self._cameraRightAtArStartedMoment = self._camera.right.clone();
        self._cameraUpAtArStartedMoment = self._camera.up.clone();
        self._cameraPositionAtArStartedMoment = self._camera.position.clone(
          new Cesium.Cartesian3()
        );
        self._cameraHeadingAtArStartedMoment = self._camera.heading;
        self._cameraPitchAtArStartedMoment = self._camera.pitch;

        self._FPVStarted.raiseEvent();
        self._enabled = true;
      },
    });
  };

  CesiumFVPCameraController.prototype.exitFPV = function () {
    this._enableDefaultScreenSpaceCameraController();
    this._disconnectEventHandlers();
    this._setDefaultView();
    this._startFPVPositionMobile = null;
    this._allowStartPositionTap = false;
    this._FPVFinished.raiseEvent();
    this._enabled = false;
  };

  CesiumFVPCameraController.prototype._onKeyDown = function (event) {
    const keyCode = event.keyCode;

    this._direction = DIRECTION_NONE;

    switch (keyCode) {
      case "W".charCodeAt(0):
        this._direction = DIRECTION_FORWARD;
        return;
      case "S".charCodeAt(0):
        this._direction = DIRECTION_BACKWARD;
        return;
      case "D".charCodeAt(0):
        this._direction = DIRECTION_RIGHT;
        return;
      case "A".charCodeAt(0):
        this._direction = DIRECTION_LEFT;
        return;
      case 90: // z
        if (this._main3dTileset)
          this._main3dTileset.show = !this._main3dTileset.show;
        return;
      default:
        return;
    }
  };

  //noinspection JSUnusedLocalSymbols
  CesiumFVPCameraController.prototype._onKeyUp = function () {
    this._direction = DIRECTION_NONE;
  };

  CesiumFVPCameraController.prototype._onMouseLButtonClicked = function (
    movement
  ) {
    if (this._startFPVPositionMobile == null) {
      if (this._allowStartPositionTap)
        this._startFPVPositionMobile = movement.position.clone();
    }

    this._isMouseLeftButtonPressed = true;
    this._mousePosition = this._startMousePosition = movement.position.clone();
  };

  CesiumFVPCameraController.prototype._startFPV = function (screenPosition) {
    const scene = this._cesiumViewer.scene;
    let globe = scene.globe;

    globe.depthTestAgainstTerrain = true;

    const pickRay = scene.camera.getPickRay(screenPosition);

    const result = scene.pickFromRay(pickRay);

    if (!result) {
      alert("Unfortunately failed to enter FPV!");
      console.warn("pickFromRay failed!");
      return;
    }

    const pickedCartographic = globe.ellipsoid.cartesianToCartographic(
      result.position
    );

    // consider terrain height
    const terrainHeightAtPickedCartographic = globe.getHeight(
      pickedCartographic
    );

    if (terrainHeightAtPickedCartographic === undefined) {
      alert("Unfortunately failed to enter FPV!");
      console.warn("globe.getHeight(cartographic) failed!");
      return;
    }

    // determine we clicked out of main 3d tileset
    if (
      Cesium.Math.equalsEpsilon(
        pickedCartographic.height,
        terrainHeightAtPickedCartographic,
        Cesium.Math.EPSILON4,
        Cesium.Math.EPSILON1
      )
    ) {
      if (!this._isMobile)
        alert("Please double click exactly on target 3d tile!");
      else alert("Please tap exactly on target 3d tile!");
      return;
    }

    // I am not sure why negative
    if (pickedCartographic.height < 0) {
      alert("Unfortunately failed to enter FPV!");
      console.warn("cartographic.height < 0");
      return;
    }

    pickedCartographic.height = pickedCartographic.height + HUMAN_EYE_HEIGHT;

    this._doStartFPV(pickedCartographic);
  };

  CesiumFVPCameraController.prototype._onMouseLButtonDoubleClicked = function (
    movement
  ) {
    if (this._enabled) return;

    this._startFPV(movement.position);
  };

  CesiumFVPCameraController.prototype._onMouseMove = function (movement) {
    this._mousePosition = movement.endPosition;
  };

  //noinspection JSUnusedLocalSymbols
  CesiumFVPCameraController.prototype._onMouseUp = function (position) {
    this._isMouseLeftButtonPressed = false;
  };

  CesiumFVPCameraController.prototype._changeCameraHeadingPitchByMouse = function (
    dt
  ) {
    const width = this._canvas.clientWidth;
    const height = this._canvas.clientHeight;

    // Coordinate (0.0, 0.0) will be where the mouse was clicked.
    const deltaX = (this._mousePosition.x - this._startMousePosition.x) / width;
    const deltaY =
      -(this._mousePosition.y - this._startMousePosition.y) / height;

    const currentHeadingInDegree = Cesium.Math.toDegrees(this._camera.heading);
    const deltaHeadingInDegree = deltaX * ROTATE_SPEED;
    const newHeadingInDegree = currentHeadingInDegree + deltaHeadingInDegree;

    const currentPitchInDegree = Cesium.Math.toDegrees(this._camera.pitch);
    const deltaPitchInDegree = deltaY * ROTATE_SPEED;
    let newPitchInDegree = currentPitchInDegree + deltaPitchInDegree;

    newPitchInDegree = this._validPitch(newPitchInDegree);

    this._camera.setView({
      orientation: {
        heading: Cesium.Math.toRadians(newHeadingInDegree),
        pitch: Cesium.Math.toRadians(newPitchInDegree),
        roll: this._camera.roll,
      },
    });
  };

  CesiumFVPCameraController.prototype._getCurrentCameraPositionAtCollisionHeight = function () {
    const currentCameraPosition = this._camera.position;

    const magnitude = Cesium.Cartesian3.magnitude(currentCameraPosition);
    const scalar =
      (magnitude - HUMAN_EYE_HEIGHT + COLLISION_RAY_HEIGHT) / magnitude;

    return Cesium.Cartesian3.multiplyByScalar(
      currentCameraPosition,
      scalar,
      new Cesium.Cartesian3()
    );
  };

  CesiumFVPCameraController.prototype._changeCameraPosition = function (dt) {
    let direction = new Cesium.Cartesian3();

    if (this._direction === DIRECTION_FORWARD)
      Cesium.Cartesian3.multiplyByScalar(this._camera.direction, 1, direction);
    else if (this._direction === DIRECTION_BACKWARD)
      Cesium.Cartesian3.multiplyByScalar(this._camera.direction, -1, direction);
    else if (this._direction === DIRECTION_LEFT)
      Cesium.Cartesian3.multiplyByScalar(this._camera.right, -1, direction);
    else if (this._direction === DIRECTION_RIGHT)
      Cesium.Cartesian3.multiplyByScalar(this._camera.right, 1, direction);

    const stepDistance = this._walkingSpeed() * dt;

    const deltaPosition = Cesium.Cartesian3.multiplyByScalar(
      direction,
      stepDistance,
      new Cesium.Cartesian3()
    );

    const startPosition = this._getCurrentCameraPositionAtCollisionHeight();

    const endPosition = Cesium.Cartesian3.add(
      startPosition,
      deltaPosition,
      new Cesium.Cartesian3()
    );

    if (!this._canMove(startPosition, endPosition, stepDistance)) {
      console.warn("collision detected. can not move!");
      return;
    }

    const cameraPosition = this._getRevisedCameraPosition(endPosition);

    this._camera.setView({
      destination: cameraPosition,
      orientation: new Cesium.HeadingPitchRoll(
        this._camera.heading,
        this._camera.pitch,
        this._camera.roll
      ),
      endTransform: Cesium.Matrix4.IDENTITY,
    });
  };

  // check collision

  CesiumFVPCameraController.prototype._canMove = function (
    startPosition,
    endPosition,
    stepDistance
  ) {
    /**
     * code snippet to reconsider
     */

    /*
        const scene = this._cesiumViewer.scene;
        const globe = scene.globe;
        const ellipsoid = globe.ellipsoid;

        const startCartographic = ellipsoid.cartesianToCartographic(startPosition);
        const endCartographic = ellipsoid.cartesianToCartographic(endPosition);

        const startHeight =  scene.sampleHeight(startCartographic);
        const endHeight =  scene.sampleHeight(endCartographic);

        const deltaHeight = endHeight - startHeight;

        if(deltaHeight > 0.5)
        {
            console.warn('can not move 0.5 m higher position!');
            return false;
        }

         */

    if (this._ignoreCollisionDetection) return true;

    const rayDirection = Cesium.Cartesian3.subtract(
      endPosition,
      startPosition,
      new Cesium.Cartesian3()
    );

    let ray = new Cesium.Ray(startPosition, rayDirection);

    // horizontal pick
    const result = this._cesiumViewer.scene.pickFromRay(ray);

    if (Cesium.defined(result)) {
      // check collision
      const distanceToIntersection = Cesium.Cartesian3.distanceSquared(
        startPosition,
        result.position
      );

      if (distanceToIntersection >= stepDistance) {
        // we can safely move to endPosition
        return true;
      } else {
        // in future please consider vertical height difference
        return false;
      }
    } else return true;
  };

  CesiumFVPCameraController.prototype._getRevisedCameraPosition = function (
    targetPosition
  ) {
    const scene = this._cesiumViewer.scene;
    const globe = scene.globe;
    const ellipsoid = globe.ellipsoid;

    const targetCartographic = ellipsoid.cartesianToCartographic(
      targetPosition
    );

    const heightAtTargetPosition = scene.sampleHeight(targetCartographic);

    const currentCameraCartographic = ellipsoid.cartesianToCartographic(
      this._camera.position
    );

    // console.log('heightAtTargetPosition: ' + heightAtTargetPosition);
    // console.log('current camera height: ' + currentCameraCartographic.height);

    if (heightAtTargetPosition === undefined) {
      console.warn("heightAtTargetPosition is undefined");
      /**
       *  in future we need to think why heightAtTargetPosition is undefined
       */

      //return null;

      targetCartographic.height = currentCameraCartographic.height;
      return ellipsoid.cartographicToCartesian(targetCartographic);
    }

    if (heightAtTargetPosition < 0) {
      /**
       *  in future we need to think why heightAtTargetPosition is negative
       */

      console.warn("heightAtTargetPosition is negative");
      //return null;

      targetCartographic.height = currentCameraCartographic.height;
      return ellipsoid.cartographicToCartesian(targetCartographic);
    }

    if (heightAtTargetPosition > currentCameraCartographic.height) {
      /**
       * code snippet to reconsider
       */
      targetCartographic.height = currentCameraCartographic.height;
    } else {
      targetCartographic.height = heightAtTargetPosition + HUMAN_EYE_HEIGHT;
    }

    return ellipsoid.cartographicToCartesian(targetCartographic);
  };

  CesiumFVPCameraController.prototype._onClockTick = function (clock) {
    if (this._isMobile) return;

    const dt = clock._clockStep;

    if (this._isMouseLeftButtonPressed)
      this._changeCameraHeadingPitchByMouse(dt);

    if (this._direction !== DIRECTION_NONE) {
      this._changeCameraPosition(dt);
    }
  };

  CesiumFVPCameraController.prototype.isEnabled = function () {
    return this._enabled;
  };

  CesiumFVPCameraController.prototype._disableDefaultScreenSpaceCameraController = function () {
    const scene = this._cesiumViewer.scene;

    // disable the default event handlers

    scene.screenSpaceCameraController.enableRotate = false;
    scene.screenSpaceCameraController.enableTranslate = false;
    scene.screenSpaceCameraController.enableZoom = false;
    scene.screenSpaceCameraController.enableTilt = false;
    scene.screenSpaceCameraController.enableLook = false;
  };

  CesiumFVPCameraController.prototype._enableDefaultScreenSpaceCameraController = function () {
    const scene = this._cesiumViewer.scene;

    // disable the default event handlers

    scene.screenSpaceCameraController.enableRotate = true;
    scene.screenSpaceCameraController.enableTranslate = true;
    scene.screenSpaceCameraController.enableZoom = true;
    scene.screenSpaceCameraController.enableTilt = true;
    scene.screenSpaceCameraController.enableLook = true;
  };

  CesiumFVPCameraController.prototype.getViewData = function () {
    const camera = this._cesiumViewer.camera;

    const cartographic = this._cesiumViewer.scene.globe.ellipsoid.cartesianToCartographic(
      camera.position
    );

    const viewData = {};

    viewData.longitude = cartographic.longitude;
    viewData.latitude = cartographic.latitude;
    viewData.height = cartographic.height;

    viewData.heading = camera.heading;
    viewData.pitch = camera.pitch;
    viewData.roll = camera.roll;

    return JSON.stringify(viewData);
  };

  CesiumFVPCameraController.prototype._setDefaultView = function () {
    if (
      this._defaultCameraPositionOrientationJson !== undefined &&
      this._defaultCameraPositionOrientationJson !== ""
    ) {
      let defaultCameraPositionDirection = JSON.parse(
        this._defaultCameraPositionOrientationJson
      );

      const cartographic = new Cesium.Cartographic(
        defaultCameraPositionDirection.longitude,
        defaultCameraPositionDirection.latitude,
        defaultCameraPositionDirection.height
      );

      this._cesiumViewer.camera.flyTo({
        destination: this._cesiumViewer.scene.globe.ellipsoid.cartographicToCartesian(
          cartographic
        ),
        orientation: {
          heading: defaultCameraPositionDirection.heading,
          pitch: defaultCameraPositionDirection.pitch,
          roll: defaultCameraPositionDirection.roll,
        },
      });
    } else {
      this._camera.flyToBoundingSphere(this._main3dTileset.boundingSphere);
    }
  };

  CesiumFVPCameraController.prototype._walkingSpeed = function () {
    const lastFPS = this._frameMonitor.lastFramesPerSecond;

    const defaultWorkingSpeed = DEFAULT_HUMAN_WALKING_SPEED;

    if (lastFPS === undefined) {
      return defaultWorkingSpeed;
    }

    const factor = 30;

    return (defaultWorkingSpeed * factor) / lastFPS;
  };

  CesiumFVPCameraController.prototype.FPVStarted = function () {
    return this._FPVStarted;
  };

  CesiumFVPCameraController.prototype.FPVFinished = function () {
    return this._FPVFinished;
  };

  CesiumFVPCameraController.prototype.startFPVMobile = function () {
    /*
        const width = this._canvas.clientWidth;
        const height = this._canvas.clientHeight;

        const screenCenterPosition = new Cesium.Cartesian2(width / 2 , height / 2);
        */

    this._startFPV(this._startFPVPositionMobile);
  };

  CesiumFVPCameraController.prototype._getModifiedCurrentCameraPositionMobile = function () {
    const currentCameraPosition = this._cameraPositionAtArStartedMoment;

    const magnitude = Cesium.Cartesian3.magnitude(currentCameraPosition);
    const scalar =
      (magnitude - HUMAN_EYE_HEIGHT + COLLISION_RAY_HEIGHT) / magnitude;

    return Cesium.Cartesian3.multiplyByScalar(
      currentCameraPosition,
      scalar,
      new Cesium.Cartesian3()
    );
  };

  CesiumFVPCameraController.prototype._validPitch = function (pitch) {
    if (pitch > MAX_PITCH_IN_DEGREE * 2 && pitch < 360 - MAX_PITCH_IN_DEGREE) {
      pitch = 360 - MAX_PITCH_IN_DEGREE;
    } else {
      if (pitch > MAX_PITCH_IN_DEGREE && pitch < 360 - MAX_PITCH_IN_DEGREE) {
        pitch = MAX_PITCH_IN_DEGREE;
      }
    }

    return pitch;
  };

  CesiumFVPCameraController.prototype.setView = function (
    translationX,
    translationY,
    translationZ,
    rotationX,
    rotationY,
    rotationZ
  ) {
    if (
      translationX == this._lastTranslationX &&
      translationZ == this._lastTranslationZ &&
      rotationX == this._lastRotationX &&
      rotationY == this._lastRotationY
    )
      return;

    let cameraPosition;

    const right = Cesium.Cartesian3.multiplyByScalar(
      this._cameraRightAtArStartedMoment,
      translationX,
      new Cesium.Cartesian3()
    );
    const direction = Cesium.Cartesian3.multiplyByScalar(
      this._cameraDirectionAtArStartedMoment,
      -translationZ,
      new Cesium.Cartesian3()
    );
    const up = Cesium.Cartesian3.multiplyByScalar(
      this._cameraUpAtArStartedMoment,
      translationY,
      new Cesium.Cartesian3()
    );

    let deltaPosition = Cesium.Cartesian3.add(
      right,
      direction,
      new Cesium.Cartesian3()
    );

    // we ignore up movement
    //deltaPosition = Cesium.Cartesian3.add(deltaPosition, up, new Cesium.Cartesian3());

    if (deltaPosition.equals(Cesium.Cartesian3.ZERO)) {
      cameraPosition = this._cameraPositionAtArStartedMoment.clone();
    } else {
      const startPosition = this._getModifiedCurrentCameraPositionMobile();

      const endPosition = Cesium.Cartesian3.add(
        startPosition,
        deltaPosition,
        new Cesium.Cartesian3()
      );

      if (
        !this._canMove(
          startPosition,
          endPosition,
          Cesium.Cartesian3.magnitude(deltaPosition)
        )
      ) {
        console.warn("collision detected. can not move!");
        cameraPosition = this._cameraPositionAtArStartedMoment.clone();
      } else {
        cameraPosition = this._getRevisedCameraPosition(endPosition);
      }
    }

    // change orientation

    const originalHeadingInDegree = Cesium.Math.toDegrees(
      this._cameraHeadingAtArStartedMoment
    );
    const newHeadingInDegree = originalHeadingInDegree + rotationX;

    const originalPitchInDegree = Cesium.Math.toDegrees(
      this._cameraPitchAtArStartedMoment
    );
    let newPitchInDegree = originalPitchInDegree + rotationY;

    newPitchInDegree = this._validPitch(newPitchInDegree);

    // we ignore roll
    this._camera.setView({
      destination: cameraPosition,
      orientation: {
        heading: Cesium.Math.toRadians(newHeadingInDegree),
        pitch: Cesium.Math.toRadians(newPitchInDegree),
        roll: this._camera.roll,
      },
      endTransform: Cesium.Matrix4.IDENTITY,
    });

    this._lastTranslationX = translationX;
    this._lastTranslationY = translationY;
    this._lastTranslationZ = translationZ;

    this._lastRotationX = rotationX;
    this._lastRotationY = rotationY;
    this._lastRotationZ = rotationZ;
  };

  CesiumFVPCameraController.prototype.startFPVPositionMobile = function () {
    return this._startFPVPositionMobile;
  };

  CesiumFVPCameraController.prototype.setDirectionLeft = function () {
    this._direction = DIRECTION_LEFT;
  };

  CesiumFVPCameraController.prototype.setDirectionRight = function () {
    this._direction = DIRECTION_RIGHT;
  };

  CesiumFVPCameraController.prototype.setDirectionForward = function () {
    this._direction = DIRECTION_FORWARD;
  };

  CesiumFVPCameraController.prototype.setDirectionBackward = function () {
    this._direction = DIRECTION_BACKWARD;
  };

  CesiumFVPCameraController.prototype.setDirectionNone = function () {
    this._direction = DIRECTION_NONE;
  };

  return CesiumFVPCameraController;
})();
