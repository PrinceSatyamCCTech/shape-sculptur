import React, { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import earcut from "earcut";
import "./Viewer.css";

const Viewer = () => {
  const canvasRef = useRef(null);

  const [drawingMode, setDrawingMode] = useState(false);
  const [extrudingMode, setExtrudingMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [vertexEditMode, setVertexEditMode] = useState(false);

  const drawingRef = useRef(drawingMode);
  const extrudingRef = useRef(extrudingMode);
  const moveRef = useRef(moveMode);
  const vertexEditRef = useRef(vertexEditMode);
  const initialize = useRef(false);

  useEffect(() => {
    drawingRef.current = drawingMode;
  }, [drawingMode]);

  useEffect(() => {
    extrudingRef.current = extrudingMode;
  }, [extrudingMode]);

  useEffect(() => {
    moveRef.current = moveMode;
  }, [moveMode]);

  useEffect(() => {
    vertexEditRef.current = vertexEditMode;
  }, [vertexEditMode]);

  let polygonShape = useRef(null);
  let extrudedShape = useRef(null);

  let drawingPoints = [];
  let vertexPoints = [];
  let meshSphere = [];

  useEffect(() => {
    // Initialize Babylon.js
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

    scene.onPointerDown = (event) => {
      if (drawingRef.current && event.button === 0) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit) {
          const point = pickResult.pickedPoint.clone();
          const marker = BABYLON.MeshBuilder.CreateSphere("marker", { diameter: 0.2 }, scene);
          meshSphere.push(marker);
          marker.position = point;
          drawingPoints.push(point);
        }
      }

      // Create a polygon shape from the drawing points
      if (drawingRef.current && event.button === 2 && drawingPoints.length >= 3) {
        polygonShape.current = BABYLON.MeshBuilder.CreatePolygon(
          "polygonShape",
          { shape: drawingPoints },
          scene,
          earcut
        );
        polygonShape.current.position.y = 0.01;

        const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0, 0, 1);
        polygonShape.current.material = groundMaterial;

        meshSphere.forEach((sphere) => sphere.dispose());
        setDrawingMode(false);
      }

      // Extrude the polygon shape
      if (extrudingRef.current && event.button === 0) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && pickResult.pickedMesh === polygonShape.current) {
          extrudedShape.current = BABYLON.MeshBuilder.ExtrudePolygon(
            "extrudedShape",
            { shape: drawingPoints, depth: 2, wrap: true, updatable: true },
            scene,
            earcut
          );
          extrudedShape.current.position.y = 2;

          const extrudeMat = new BABYLON.StandardMaterial("Extruded Mesh Material", scene);
          extrudeMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
          extrudeMat.backFaceCulling = false;
          extrudeMat.twoSidedLighting = true;
          extrudedShape.current.material = extrudeMat;

          polygonShape.current.dispose();
          setExtrudingMode(false);
        }
      }

      // Move the extruded shape
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      if (pickResult.hit && pickResult.pickedMesh === extrudedShape.current && moveRef.current) {
        pickResult.pickedMesh.addBehavior(new BABYLON.PointerDragBehavior({ dragPlaneNormal: BABYLON.Vector3.Up() }));
      } else if (pickResult.pickedMesh) {
        pickResult.pickedMesh.removeBehavior(new BABYLON.PointerDragBehavior({ dragPlaneNormal: BABYLON.Vector3.Up() }));
      }

      // Edit the vertices of the extruded shape
      if (vertexEditRef.current) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && pickResult.pickedMesh === extrudedShape.current && event.button === 0) {
          let verticesData = [];
          const sharedVertices = new Map();
          const uniqueVertices = [];
          let originalVertexData = extrudedShape.current.getVerticesData(BABYLON.VertexBuffer.PositionKind);
          const worldMatrix = extrudedShape.current.getWorldMatrix();

          for (let i = 0; i < originalVertexData.length; i += 3) {
            const originalVertex = new BABYLON.Vector3(
              originalVertexData[i],
              originalVertexData[i + 1],
              originalVertexData[i + 2]
            );
            verticesData.push(originalVertex.asArray());
          }

          verticesData.forEach((vertex, index) => {
            const key = vertex.join(" ");
            if (sharedVertices.has(key)) {
              sharedVertices.set(key, [...sharedVertices.get(key), index]);
            } else {
              sharedVertices.set(key, [index]);
              const transformedVertex = BABYLON.Vector3.TransformCoordinates(
                BABYLON.Vector3.FromArray(vertex),
                worldMatrix
              ).asArray();
              uniqueVertices.push({ vertex: transformedVertex, key });
            }
          });

          uniqueVertices.forEach(({ vertex, key }) => {
            const indices = sharedVertices.get(key);
            const pointerDrag = new BABYLON.PointerDragBehavior();

            pointerDrag.onDragObservable.add((info) => {
              indices.forEach((index) => {
                verticesData[index] = BABYLON.Vector3.FromArray(verticesData[index])
                  .add(info.delta)
                  .asArray();
              });

              extrudedShape.current.updateVerticesData(BABYLON.VertexBuffer.PositionKind, verticesData.flat());
            });

            const sphere = BABYLON.MeshBuilder.CreateSphere("vertexSphere", { diameter: 0.3 }, scene);
            sphere.position = BABYLON.Vector3.FromArray(vertex);
            pointerDrag.dragDeltaRatio = 1;
            sphere.addBehavior(pointerDrag);
            vertexPoints.push(sphere);
          });
        }
      }
    };

    return () => {
      window.removeEventListener("resize", resizeHandler);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />
      <div className="controls">
        <button
          className="ribbon-button"
          onClick={() => { setDrawingMode(true); initialize.current = true; }}
        >
          Draw
        </button>
        <button
          className="ribbon-button"
          onClick={() => setExtrudingMode(true)}
          disabled={!initialize.current}
          style={{ backgroundColor: (!initialize.current) ? "red" : "" }}
        >
          Extrude
        </button>
        <button
          className="ribbon-button"
          onClick={() => setMoveMode((prev) => !prev)}
          disabled={!initialize.current}
          style={{ backgroundColor: (!initialize.current) ? "red" : "" }}
        >
          Move
        </button>
        <button
          className="ribbon-button"
          onClick={() =>
            setVertexEditMode((prev) => {
              if (prev) {
                vertexPoints.forEach((vertex) => vertex.dispose());
                vertexPoints = [];
              }
              return !prev;
            })
          }
          disabled={!initialize.current}
          style={{ backgroundColor: (!initialize.current) ? "red" : "" }}
        >
          Edit Vertex
        </button>
      </div>
    </div>
  );
};

export default Viewer;