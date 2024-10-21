import { AdvancedDynamicTexture, Button } from "@babylonjs/gui";

// Create a button with the given name and add it to the GUI
const CustomButton = (
  buttonName,
  gui = AdvancedDynamicTexture.CreateFullscreenUI(
    "UI",
    true,
    scene
  )
) => {
  let btn = Button.CreateSimpleButton("Button", buttonName);
  btn.width = 0.09;
  btn.height = "50px";
  btn.cornerRadius = 10;
  btn.color = "#fcfdff";
  btn.thickness = 2;
  btn.background = "#002aff";
  gui.addControl(btn);
  return btn;
};

export default CustomButton;