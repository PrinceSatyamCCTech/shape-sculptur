import React, { useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import earcut from "earcut";
import "./ShapeShifter.css";
import Viewer from "./Viewer";
import CustomButton from "./CustomButton";

const ShapeShifter = () => {
  const canvasRef = useRef(null);

  // Variables to track different modes
  let insideDrawMode = false;
  let insideEditVertexMode = false;
  let insideMoveMode = false;
  let insideExtrudeMode = false;
  let lastMovedMesh = null;
  let model = null;
  // PointerDragBehavior for mouse interactions
  const pointerDrag = new BABYLON.PointerDragBehavior({
    dragPlaneNormal: BABYLON.Vector3.Up(),
  });

  // Function to change the button color based on the mode
  const changeButtonColor = (button, mode) => {
    button.background = mode ? "#041b8f" : "#002aff";
  };

  useEffect(() => {
    let meshesArr = [];
    let positions = [];
    let polygon = null;
    let mesh = null;
    let extrudeExtent = 2;
    let vertexcontrols = [];
    let polygonList = [];
    let draw = null;
    // Dictionary to store polygon objects and their coordinates
    const polygonCoordinates = new Map();

    const { scene, ground, resizeHandler, engine } = Viewer(canvasRef);
    // Create a material for the extruded mesh and set its properties
    const extrudeMat = new BABYLON.StandardMaterial("Extruded Mesh Material", scene);
    extrudeMat.diffuseColor = BABYLON.Color3.Red();
    extrudeMat.backFaceCulling = false;
    extrudeMat.twoSidedLighting = true;

    // Create a default material that can be used for buffer shapes
    const mat = new BABYLON.StandardMaterial("mat", scene);
    mat.emissiveColor = BABYLON.Color3.Green();

    // Create a polygon shape from the drawing points
    const handleDrawMode = (event, pickResult) => {
      if (pickResult.faceId !== -1 && insideDrawMode) {
        if (event.button === 0) {
          const Mesh = BABYLON.MeshBuilder.CreateSphere(
            "PlaceHolder",
            { diameter: 0.15 },
            scene
          );
          const point = pickResult.pickedPoint.clone();
          try {
            Mesh.position = pickResult.pickedPoint;
            meshesArr.push(Mesh);
            positions.push(new BABYLON.Vector2(Mesh.position._x, Mesh.position._z));
            polygonList.push(point);
          } catch (error) {
            console.error(error);
          }
        }
        if (event.button === 2) {
          if (positions.length < 3) {
            alert("Sorry dude, atleast atleast 3 points are required to create a polygon");
            return;
          }
          // Right-click to Complete the shape and create a polygon mesh
          const newPolygon = new BABYLON.PolygonMeshBuilder(
            "polygon",
            positions,
            scene,
            earcut
          );
          polygon = newPolygon.build();
          polygon.position.y = 0.01;
          polygon.material = mat;
          polygonCoordinates.set(polygon, [polygonList, 0]);
          const len = meshesArr.length;
          for (let i = 0; i < len; i++) {
            meshesArr[i]?.dispose();
            if (i === len - 1) {
              meshesArr = [];
            }
          }
          polygonList = [];
          positions = [];
        }
      }
    };

    // Extrude the polygon shape
    const handleExtrudeMode = () => {
      // if (insideExtrudeMode && pickResult.pickedMesh != ground && pickResult.faceId != -1 && event.button === 0)
      if (insideExtrudeMode) 
      {
        polygonCoordinates.forEach((polygonProps, polygon) => { 
          if (polygonCoordinates.get(polygon)[1] === 0){
            mesh = BABYLON.MeshBuilder.ExtrudePolygon(
              "Extruded Mesh Material",
              {
                shape: polygonProps[0],
                depth: extrudeExtent,
                sideOrientation: 1,
                wrap: true,
                updatable: true,
              },
              scene,
              earcut
            );
            polygonCoordinates.get(polygon)[1] = 1;
            const extrudeMat = new BABYLON.StandardMaterial("Extruded Mesh Material", scene);
            extrudeMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
            extrudeMat.backFaceCulling = false;
            extrudeMat.twoSidedLighting = true;
            mesh.material = extrudeMat;
            mesh.position.y = extrudeExtent;
            polygon.dispose();
            polygonProps[0].forEach((pnts) => pnts.dispose);
          }
        });
      }
    };

    // Move the extruded shape
    const handleMoveMode = (pickResult) => {
      if (pickResult.faceId != -1 && pickResult.pickedMesh != ground) {
        if (insideMoveMode){
          if (lastMovedMesh && lastMovedMesh !== pickResult.pickedMesh) lastMovedMesh.removeBehavior(pointerDrag);
          pickResult.pickedMesh.addBehavior(pointerDrag);
          lastMovedMesh = pickResult.pickedMesh;
        }
        else pickResult.pickedMesh.removeBehavior(pointerDrag);
      }
    };

    // Edit the vertices of the extruded shape
    const handleEditVertexMode = (event, pickResult) => {
      if (insideEditVertexMode && pickResult.pickedMesh != ground && pickResult.faceId != -1
        && event.button === 0 && !pickResult.pickedMesh.name.includes("vertexcontrol")) {
        if (model) {
          model = null;
          vertexcontrols.forEach((control) => control.dispose());
          vertexcontrols = [];
        }
        model = pickResult.pickedMesh;
        const transformation = model.getWorldMatrix();
        let vertices = model
          .getVerticesData(BABYLON.VertexBuffer.PositionKind)
          .reduce((all, one, i) => {
            const ch = Math.floor(i / 3);
            all[ch] = [].concat(all[ch] ?? [], one);
            return all;
          }, []);

        const shared = new Map();
        const unique = [];

        vertices.forEach((vertex, index) => {
          const key = vertex.join(" ");
          if (shared.has(key)) {
            shared.set(key, [...shared.get(key), index]);
          } else {
            shared.set(key, [index]);
            unique.push({
              vertex: BABYLON.Vector3.TransformCoordinates(
                BABYLON.Vector3.FromArray(vertex),
                transformation
              ).asArray(),
              key,
            });
          }
        });

        unique.forEach(({ vertex, key }) => {
          const indices = shared.get(key);

          const behaviour = new BABYLON.PointerDragBehavior();
          behaviour.dragDeltaRatio = 1;
          behaviour.onDragObservable.add((info) => {
            indices.forEach((index) => {
              vertices[index] = BABYLON.Vector3.FromArray(vertices[index])
                .add(info.delta)
                .asArray();
            });
            model.updateVerticesData(
              BABYLON.VertexBuffer.PositionKind,
              vertices.flat()
            );
          });

          const draggable = BABYLON.MeshBuilder.CreateSphere(
            `vertexcontrol-${indices.join("_")}`,
            {
              diameter: 0.25,
              updatable: true,
            },
            scene
          );
          draggable.position = BABYLON.Vector3.FromArray(vertex);
          draggable.addBehavior(behaviour);

          vertexcontrols.push(draggable);
        });
      }
    };

    // Entry point
    scene.onPointerDown = (event) => {
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      handleDrawMode(event, pickResult);
      handleExtrudeMode(event, pickResult);
      handleMoveMode(pickResult);
      handleEditVertexMode(event, pickResult);
    };

    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      "UI",
      true,
      scene
    );

    draw = CustomButton("Draw", advancedTexture);
    draw.top = "45%";
    draw.left = "-18%";
    draw.onPointerDownObservable.add(() => {
      insideDrawMode = !insideDrawMode;
      positions = [];
      changeButtonColor(draw, insideDrawMode);    
    });

    const extrudeButton = CustomButton("Extrude", advancedTexture);
    extrudeButton.top = "45%";
    extrudeButton.left = "-95";
    extrudeButton.onPointerDownObservable.add(() => {
      insideExtrudeMode = !insideExtrudeMode;
      changeButtonColor(extrudeButton, insideExtrudeMode);
      if (insideExtrudeMode) handleExtrudeMode();
    });

    const move = CustomButton("Move", advancedTexture);
    move.top = "45%";
    move.left = "6%";
    move.onPointerDownObservable.add(() => {
      insideMoveMode = !insideMoveMode;
      changeButtonColor(move, insideMoveMode);
    });

    const moveVerts = CustomButton("Move Vertices", advancedTexture);
    moveVerts.top = "45%";
    moveVerts.left = "18%";
    moveVerts.onPointerDownObservable.add(() => {
      insideEditVertexMode = !insideEditVertexMode;
      if (!insideEditVertexMode) {
        model = null;
        vertexcontrols.forEach((control) => control.dispose());
        vertexcontrols = [];
      }
      changeButtonColor(moveVerts, insideEditVertexMode);
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    window.addEventListener("resize", () => {
      engine.resize();
    });

    return () => {
      window.removeEventListener("resize", resizeHandler);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <>
      <div style={{ position: "relative" }}></div>
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />
    </>
  );
};

export default ShapeShifter;
