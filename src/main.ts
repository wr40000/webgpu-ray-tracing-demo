import { Scene } from "./scene";
import { Renderer } from "./renderer";

const init = async () => {
    const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("gfx-main");

    const triangleCountLabel: HTMLElement = <HTMLElement>document.getElementById("triangle-count");
    
    const scene: Scene = new Scene(canvas);
    await scene.make_scene();
    
    triangleCountLabel.innerText = scene.triangleCount.toString();

    const renderer = new Renderer(canvas, scene);

    await renderer.Initialize();

    renderer.render()
}

init()


