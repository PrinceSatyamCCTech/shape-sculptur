import { AdvancedDynamicTexture, Button } from "@babylonjs/gui";

const Button = (
  buttonName,
  gui = AdvancedDynamicTexture.CreateFullscreenUI("myUI")
) => {
  let btn = Button.CreateSimpleButton("Button", buttonName);
  btn.width = 0.2;
  btn.height = "60px";
  btn.cornerRadius = 20;
  btn.color = "#0f0f0f";
  btn.thickness = 4;
  btn.background = "#ffff00";
  gui.addControl(btn);
  return btn;
};

export default Button;