
# 2D Shape Extrusion and Manipulation

The goal of this project is to create a webapp using babylon.js which allows users to draw arbitrary 2D shapes on the ground plane, extrude them into 3D objects with a fixed height, and then manipulate those objects by moving the object and editing their vertices using buttons for mode selection.

## Features:
1. Draw:
Click on `Draw` button to enter the Draw mode and left-click to add points, right-click to complete the shape. Minimum three points required.

2. Extrude:
Click on `Extrude` button to enter the extrude mode and initiate the extrusion process. The extrusion height is a fixed hard coded value.

3. Move:
Click on `Move` button to enter the move mode which allows the user to move the extruded objects on the ground plane using mouse interactions (If using laptop's touchpad, double click and then drag).

4. Edit Vertex:
Click on `Edit Vertex` button to enter the edit vertex mode to edit the vertices of the extruded object using mouse interactions. All vertices of the shape is editable and we can freely move the vertices in 3D space.

## Setup:
1. Clone the repo using `git clone`
2. Go to the repo location and checkout to dev branch using command `git checkout dev`
3. Open the project in VS Code or you can continue on cmd and to install the node modules by entering command `npm i`
4. Once the node module installation process completes, run `npm run dev` to start the server and hit the printed url in web browser to work with the webapp