import * as BABYLON from "@babylonjs/core";

const Viewer = (canvasRef) => {
  // Initialize Babylon.js and create a viewer/scene
  const engine = new BABYLON.Engine(canvasRef.current, true);
  const scene = new BABYLON.Scene(engine);

  scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2,
    5,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.position = new BABYLON.Vector3(0, 15, -10);
  camera.attachControl(canvasRef.current, true);

  const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
  groundMaterial.diffuseColor = new BABYLON.Color3(40 / 255, 30 / 255, 0);
  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);
  ground.position.y = 0;
  ground.material = groundMaterial;

  const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

  engine.runRenderLoop(() => {
    scene.render();
  });

  const resizeHandler = () => {
    engine.resize();
  };
  window.addEventListener("resize", resizeHandler);

  return { scene, ground, resizeHandler, engine };
};

export default Viewer;
