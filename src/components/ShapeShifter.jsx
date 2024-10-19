import React, { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import earcut from "earcut";
import "./ShapeShifter.css";
import Viewer from "./Viewer";
import CustomButton from "./CustomButton";

const ShapeShifter = () => {
  const canvasRef = useRef(null);

  const [drawingMode, setDrawingMode] = useState(false);
  const [extrudingMode, setExtrudingMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [vertexEditMode, setVertexEditMode] = useState(false);

  const drawingRef = useRef(drawingMode);
  const extrudingRef = useRef(extrudingMode);
  const moveRef = useRef(moveMode);
  const vertexEditRef = useRef(vertexEditMode);
  let dragBehavior = useRef(null);

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
  let drawingPointsRev = [];
  let vertexPoints = [];
  let meshSphere = [];
  let polygon = [];
  let extrudedPolygons = [];

  useEffect(() => {
    const { scene, resizeHandler, engine } = Viewer(canvasRef);  // Pass canvasRef here
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
        polygon.push(drawingPoints);

        meshSphere.forEach((sphere) => sphere.dispose());
        drawingPoints = [];
        setDrawingMode(false);
      }

      // Extrude the polygon shape
      if (extrudingRef.current && polygon.length > 0) {
        var count = 1;
        polygon.forEach((dwgPoints) => {
          if (!extrudedPolygons.includes(dwgPoints)) {
            extrudedShape.current = BABYLON.MeshBuilder.ExtrudePolygon(
              "extrudedShape"+count,
              { shape: dwgPoints, depth: 2, wrap: true, updatable: true },
              scene,
              earcut
            );
            extrudedShape.current.position.y = 2;
            extrudedPolygons.push(dwgPoints);
  
            const extrudeMat = new BABYLON.StandardMaterial("Extruded Mesh Material", scene);
            extrudeMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
            extrudeMat.backFaceCulling = false;
            extrudeMat.twoSidedLighting = true;
            extrudedShape.current.material = extrudeMat;
            dwgPoints.forEach((pnts) => pnts.dispose);
            count++;
          }
        });
        setExtrudingMode(false);
      }

      // Move the extruded shape
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      if (pickResult.hit && moveRef.current) {
        pickResult.pickedMesh.addBehavior(new BABYLON.PointerDragBehavior({ dragPlaneNormal: BABYLON.Vector3.Up() }));
      } else if (pickResult.pickedMesh) {
        pickResult.pickedMesh.removeBehavior(new BABYLON.PointerDragBehavior({ dragPlaneNormal: BABYLON.Vector3.Up() }));
      }

      // Edit the vertices of the extruded shape
      if (vertexEditMode) {
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

    // Create an advanced texture for GUI elements that covers the entire screen
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      "UI",
      true,
      scene
    );

    const draw = CustomButton("Draw", advancedTexture);
    draw.top = "45%";
    draw.left = "-18%";
    // Toggle draw mode when the button is clicked
    draw.onPointerDownObservable.add(() => {
      if (drawingMode){
        setDrawingMode(false);
      }
      else{
        setDrawingMode(true);
      }
    });

    // Create an "Extrude" button using the CreateButton function and attach it to the advanced texture
    const extrudeButton = CustomButton("Extrude", advancedTexture);
    extrudeButton.top = "45%";
    extrudeButton.left = "-95";
    extrudeButton.onPointerDownObservable.add(() => {
      // Toggle extrudeActive mode when the button is clicked
      if (extrudingMode) setExtrudingMode(false);
      else setExtrudingMode(true);
    });

    // Create a "Move" button using the CustomButton function and attach it to the advanced texture
    const move = CustomButton("Move", advancedTexture);
    move.top = "45%";
    move.left = "6%";
    move.onPointerDownObservable.add(() => {
      // Toggle moveActive mode when the button is clicked
      if (moveMode) setMoveMode(false);
      else setMoveMode(true);
    });

    // Create a "Move Vertices" button using the CustomButton function and attach it to the advanced texture
    const moveVerts = CustomButton("Edit Vertices", advancedTexture);
    moveVerts.top = "45%";
    moveVerts.left = "18%";
    moveVerts.onPointerDownObservable.add(() => {
      // Toggle moveVertsActive mode when the button is clicked
      if (vertexEditMode) {
        setVertexEditMode(false);
        // Dispose of all control points for vertex editing and clear the vertexcontrols array
        vertexPoints.forEach((vertex) => vertex.dispose());
        vertexPoints = [];
      } else setVertexEditMode(true);
    });

    return () => {
      window.removeEventListener("resize", resizeHandler);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
};

export default ShapeShifter;