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

    scene.onPointerDown = (event) => {
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);

      // Create a polygon shape from the drawing points
      if (pickResult.faceId !== -1 && insideDrawMode) {
        // extruded = false;
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
            positions = [];
            meshesArr.forEach((mesh) => mesh.dispose());
            meshesArr = [];
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

      // Extrude the polygon shape
      if (insideExtrudeMode && pickResult.pickedMesh != ground && pickResult.faceId != -1 && event.button === 0) {
        polygonCoordinates.forEach((polygonProps, polygon) => { 
          if (polygonCoordinates.get(polygon)[1] === 1) return;
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
          // extruded = true;
          polygonCoordinates.get(polygon)[1] = 1;
          const extrudeMat = new BABYLON.StandardMaterial("Extruded Mesh Material", scene);
          extrudeMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
          extrudeMat.backFaceCulling = false;
          extrudeMat.twoSidedLighting = true;
          mesh.material = extrudeMat;
          mesh.position.y = extrudeExtent;
          polygon.dispose();
          polygonProps[0].forEach((pnts) => pnts.dispose);
          // insideExtrudeMode = false;
        });
      }

      // Move the extruded shape
      if (pickResult.faceId != -1 && pickResult.pickedMesh != ground) {
        if (insideMoveMode){
          // Remove drag behavior from the last moved mesh if it exists
          if (lastMovedMesh && lastMovedMesh !== pickResult.pickedMesh) lastMovedMesh.removeBehavior(pointerDrag);
          pickResult.pickedMesh.addBehavior(pointerDrag);
          lastMovedMesh = pickResult.pickedMesh;
        }
        else pickResult.pickedMesh.removeBehavior(pointerDrag);
      }

      // Edit the vertices of the extruded shape
      if (insideEditVertexMode && pickResult.pickedMesh != ground && pickResult.faceId != -1
        && event.button === 0 && !pickResult.pickedMesh.name.includes("vertexcontrol")) {
        if (model) {
          model = null;
          vertexcontrols.forEach((control) => control.dispose());
          vertexcontrols = [];
        }
        model = pickResult.pickedMesh;
        const transformation = model.getWorldMatrix();
        // Extract the vertices data of the model and group them into a 2D array
        let vertices = model
          .getVerticesData(BABYLON.VertexBuffer.PositionKind)
          .reduce((all, one, i) => {
            const ch = Math.floor(i / 3);
            all[ch] = [].concat(all[ch] ?? [], one);
            return all;
          }, []);

        // Create a shared map to store indices of identical vertices and an array to store unique vertices
        const shared = new Map();
        const unique = [];

        // Loop through each vertex, transform it, and store unique vertices in the shared map and unique array
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

        // Loop through unique vertices and create draggable spheres (control points) for vertex editing
        unique.forEach(({ vertex, key }) => {
          const indices = shared.get(key);

          // Create a PointerDragBehavior for each control point
          const behaviour = new BABYLON.PointerDragBehavior();
          behaviour.dragDeltaRatio = 1;
          behaviour.onDragObservable.add((info) => {
            // When the control point is dragged, update the corresponding vertices of the mesh
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

          // Create a sphere (control point) for vertex editing
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

          // Add the control point to the vertexcontrols array
          vertexcontrols.push(draggable);
        });
      }
    };

    // Create an advanced texture for GUI elements that covers the entire screen
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      "UI",
      true,
      scene
    );

    draw = CustomButton("Draw", advancedTexture);
    draw.top = "45%";
    draw.left = "-18%";
    // Toggle draw mode when the button is clicked
    draw.onPointerDownObservable.add(() => {
      if (insideDrawMode) insideDrawMode = false;
      else insideDrawMode = true;
      // Clear the positions array used for shape drawing
      positions = [];
      // Change button color
      changeButtonColor(draw, insideDrawMode);    
    });

    // Create an "Extrude" button using the CreateButton function and attach it to the advanced texture
    const extrudeButton = CustomButton("Extrude", advancedTexture);
    extrudeButton.top = "45%";
    extrudeButton.left = "-95";
    extrudeButton.onPointerDownObservable.add(() => {
      // Toggle insideExtrudeMode mode when the button is clicked
      if (insideExtrudeMode) insideExtrudeMode = false;
      else insideExtrudeMode = true;
      // Change button color
      changeButtonColor(extrudeButton, insideExtrudeMode);
    });

    // Create a "Move" button using the CustomButton function and attach it to the advanced texture
    const move = CustomButton("Move", advancedTexture);
    move.top = "45%";
    move.left = "6%";
    move.onPointerDownObservable.add(() => {
      // Toggle insideMoveMode mode when the button is clicked
      if (insideMoveMode) insideMoveMode = false;
      else insideMoveMode = true;
      // Change button color
      changeButtonColor(move, insideMoveMode);
    });

    // Create a "Move Vertices" button using the CustomButton function and attach it to the advanced texture
    const moveVerts = CustomButton("Move Vertices", advancedTexture);
    moveVerts.top = "45%";
    moveVerts.left = "18%";
    moveVerts.onPointerDownObservable.add(() => {
      // Toggle insideEditVertexMode mode when the button is clicked
      if (insideEditVertexMode) {
      insideEditVertexMode = false;
      model = null;
      // Dispose of all control points for vertex editing and clear the vertexcontrols array
      vertexcontrols.forEach((control) => control.dispose());
      vertexcontrols = [];
      } else insideEditVertexMode = true;
      // Change button color
      changeButtonColor(moveVerts, insideEditVertexMode);
    });

    // Rendering loop
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
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
};

export default ShapeShifter;