import { Scene } from "./scene";
import { Renderer } from "./renderer";

const init = async () => {
    const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("gfx-main");

    const sphereCount = 160;
    
    const sphereCountLabel: HTMLElement = <HTMLElement>document.getElementById("sphere-count");
    sphereCountLabel.innerText = sphereCount.toString();
    const scene: Scene = new Scene(canvas, sphereCount);

    const renderer = new Renderer(canvas, scene);

    await renderer.Initialize();

    renderer.render()
}

init()