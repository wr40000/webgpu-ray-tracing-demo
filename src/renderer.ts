import raytracer_kernel from "./shaders/raytracer_kernel.wgsl?raw"
import screen_shader from "./shaders/screen_shader.wgsl?raw"
import { Scene } from "./scene";
import { vec3 } from "gl-matrix";
import { CubeMapMaterial } from "./cube_material";

export class Renderer {
    canvas!: HTMLCanvasElement;
    count: number;

    // Device/Context objects
    adapter!: GPUAdapter
    device!: GPUDevice
    context!: GPUCanvasContext
    format!: GPUTextureFormat

    //Assets
    color_buffer!: GPUTexture;
    color_buffer_view!: GPUTextureView
    sampler!: GPUSampler
    sceneParameters!: GPUBuffer
    sphereBuffer!: GPUBuffer
    nodeBuffer!: GPUBuffer;
    sphereIndexBuffer!: GPUBuffer;
    sky_texture!: CubeMapMaterial;

    // Pipeline objects
    ray_tracing_pipeline!: GPUComputePipeline
    ray_tracing_bind_group_layout!: GPUBindGroupLayout
    ray_tracing_bind_group!: GPUBindGroup
    screen_pipeline!: GPURenderPipeline
    screen_bind_group_layout!: GPUBindGroupLayout
    screen_bind_group!: GPUBindGroup

    scene!: Scene

    constructor(canvas: HTMLCanvasElement, scene: Scene) {
        this.canvas = canvas;
        this.scene = scene
        this.count = 0
    }

    async Initialize() {

        await this.setupDevice();

        await this.makeBindGroupLayouts();

        await this.createAssets();

        await this.makeBindGroups();

        await this.makePipelines();
        this.render()
    }

    async setupDevice() {
        if (!navigator.gpu)
            throw new Error('Not Support WebGPU')
        this.adapter = <GPUAdapter>await navigator.gpu?.requestAdapter()
        if (!this.adapter) {
            throw new Error('No Adapter Found')
        }
        this.device = <GPUDevice>await this.adapter.requestDevice();
        this.context = <GPUCanvasContext>this.canvas.getContext('webgpu');
        this.format = 'bgra8unorm';
        this.context?.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'opaque'
        })
    }


    async makeBindGroupLayouts() {
        this.ray_tracing_bind_group_layout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba8unorm",
                        viewDimension: "2d"
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage",
                        hasDynamicOffset: false
                    }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage",
                        hasDynamicOffset: false
                    }
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage",
                        hasDynamicOffset: false
                    }
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        viewDimension: "cube",
                    }
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.COMPUTE,
                    sampler: {}
                }
            ]

        });

        this.screen_bind_group_layout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
            ]

        });
    }

    async createAssets() {
        this.color_buffer = this.device.createTexture(
            {
                size: {
                    width: this.canvas.width,
                    height: this.canvas.height,
                },
                format: "rgba8unorm",
                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
            }
        );
        this.color_buffer_view = this.color_buffer.createView();

        const samplerDescriptor: GPUSamplerDescriptor = {
            addressModeU: "repeat",
            addressModeV: "repeat",
            magFilter: "linear",
            minFilter: "nearest",
            mipmapFilter: "nearest",
            maxAnisotropy: 1
        };
        this.sampler = this.device.createSampler(samplerDescriptor);

        const parameterBufferDescriptor: GPUBufferDescriptor = {
            label: 'sceneParameters',
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        };
        this.sceneParameters = this.device.createBuffer(
            parameterBufferDescriptor
        );

        const sphereBufferDescriptor: GPUBufferDescriptor = {
            size: 8 * this.scene.spheres.length * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        };
        this.sphereBuffer = this.device.createBuffer(
            sphereBufferDescriptor
        );

        const nodeBufferDescriptor: GPUBufferDescriptor = {
            label: 'nodeBuffer',
            size: 32 * this.scene.nodesUsed,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        };
        this.nodeBuffer = this.device.createBuffer(
            nodeBufferDescriptor
        );

        const sphereIndexBufferDescriptor: GPUBufferDescriptor = {
            size: 4 * this.scene.sphereCount,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        };
        this.sphereIndexBuffer = this.device.createBuffer(
            sphereIndexBufferDescriptor
        );

        const urls = [
            "public/0/nx.jpg",  //x+
            "public/0/px.jpg",   //x-
            "public/0/ny.jpg",   //y+
            "public/0/py.jpg",  //y-
            "public/0/nz.jpg", //z+
            "public/0/pz.jpg",    //z-
            // "public/gfx/sky_front.png",  //x+
            // "public/gfx/sky_back.png",   //x-
            // "public/gfx/sky_left.png",   //y+
            // "public/gfx/sky_right.png",  //y-
            // "public/gfx/sky_bottom.png", //z+
            // "public/gfx/sky_top.png",    //z-
        ]
        this.sky_texture = new CubeMapMaterial();
        await this.sky_texture.initialize(this.device, urls);
    }

    async makeBindGroups() {
        this.ray_tracing_bind_group = this.device.createBindGroup({
            layout: this.ray_tracing_bind_group_layout,
            entries: [
                {
                    binding: 0,
                    resource: this.color_buffer_view
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.sceneParameters,
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.sphereBuffer,
                    }
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.nodeBuffer,
                    }
                },
                {
                    binding: 4,
                    resource: {
                        buffer: this.sphereIndexBuffer,
                    }
                },
                {
                    binding: 5,
                    resource: this.sky_texture.view,
                },
                {
                    binding: 6,
                    resource: this.sky_texture.sampler,
                },
            ]
        });

        this.screen_bind_group = this.device.createBindGroup({
            layout: this.screen_bind_group_layout,
            entries: [
                {
                    binding: 0,
                    resource: this.sampler
                },
                {
                    binding: 1,
                    resource: this.color_buffer_view
                }
            ]
        });
    }

    async makePipelines() {

        const ray_tracing_pipeline_layout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.ray_tracing_bind_group_layout]
        });

        this.ray_tracing_pipeline = this.device.createComputePipeline({
            layout: ray_tracing_pipeline_layout,

            compute: {
                module: this.device.createShaderModule({
                    code: raytracer_kernel,
                }),
                entryPoint: 'main',
            },
        });

        const screen_pipeline_layout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.screen_bind_group_layout]
        });

        this.screen_pipeline = this.device.createRenderPipeline({
            layout: screen_pipeline_layout,

            vertex: {
                module: this.device.createShaderModule({
                    code: screen_shader,
                }),
                entryPoint: 'vert_main',
            },

            fragment: {
                module: this.device.createShaderModule({
                    code: screen_shader,
                }),
                entryPoint: 'frag_main',
                targets: [
                    {
                        format: "bgra8unorm"
                    }
                ]
            },

            primitive: {
                topology: "triangle-list"
            }
        });
    }

    prepareScene() {
        this.scene.camera.recalculateProjection(); // 更新相机内置的canvas宽高
        this.scene.camera.updatePos()
        let rightVec = vec3.fromValues(0, 0, 3);
        vec3.cross(rightVec, this.scene.camera.forwardDirection, this.scene.camera.upDirection);
        const sceneData = {
            cameraPos: this.scene.camera.position,
            cameraForwards: this.scene.camera.forwardDirection,
            // cameraRight: this.scene.camera.rightDirection,
            cameraRight: rightVec,
            cameraUp: this.scene.camera.upDirection,
            sphereCount: this.scene.spheres.length,
        }
        const maxBounces: number = 4;
        this.device.queue.writeBuffer(
            this.sceneParameters, 0,
            new Float32Array(
                [
                    sceneData.cameraPos[0],
                    sceneData.cameraPos[1],
                    sceneData.cameraPos[2],
                    0.0,
                    sceneData.cameraForwards[0],
                    sceneData.cameraForwards[1],
                    sceneData.cameraForwards[2],
                    0.0,
                    sceneData.cameraRight[0],
                    sceneData.cameraRight[1],
                    sceneData.cameraRight[2],
                    maxBounces,
                    sceneData.cameraUp[0],
                    sceneData.cameraUp[1],
                    sceneData.cameraUp[2],
                    sceneData.sphereCount
                ]
            ), 0, 16
        )

        const sphereData: Float32Array = new Float32Array(8 * this.scene.spheres.length);

        for (let i = 0; i < this.scene.spheres.length; i++) {
            sphereData[8 * i] = this.scene.spheres[i].center[0];
            sphereData[8 * i + 1] = this.scene.spheres[i].center[1];
            sphereData[8 * i + 2] = this.scene.spheres[i].center[2];
            sphereData[8 * i + 3] = 0.0;
            sphereData[8 * i + 4] = this.scene.spheres[i].color[0];
            sphereData[8 * i + 5] = this.scene.spheres[i].color[1];
            sphereData[8 * i + 6] = this.scene.spheres[i].color[2];
            sphereData[8 * i + 7] = this.scene.spheres[i].radius;
        }

        this.device.queue.writeBuffer(this.sphereBuffer, 0, sphereData, 0, 8 * this.scene.spheres.length);

        const nodeData: Float32Array = new Float32Array(8 * this.scene.nodesUsed);
        for (let i = 0; i < this.scene.nodesUsed; i++) {
            nodeData[8 * i] = this.scene.nodes[i].minCorner[0];
            nodeData[8 * i + 1] = this.scene.nodes[i].minCorner[1];
            nodeData[8 * i + 2] = this.scene.nodes[i].minCorner[2];
            nodeData[8 * i + 3] = this.scene.nodes[i].leftChild;
            nodeData[8 * i + 4] = this.scene.nodes[i].maxCorner[0];
            nodeData[8 * i + 5] = this.scene.nodes[i].maxCorner[1];
            nodeData[8 * i + 6] = this.scene.nodes[i].maxCorner[2];
            nodeData[8 * i + 7] = this.scene.nodes[i].sphereCount;
        }
        this.device.queue.writeBuffer(this.nodeBuffer, 0, nodeData, 0, 8 * this.scene.nodesUsed);

        const sphereIndexData: Float32Array = new Float32Array(this.scene.sphereCount);
        for (let i = 0; i < this.scene.sphereCount; i++) {
            sphereIndexData[i] = this.scene.sphereIndices[i];
        }
        this.device.queue.writeBuffer(this.sphereIndexBuffer, 0, sphereIndexData, 0, this.scene.sphereCount);
    }

    render = () => {

        let start: number = performance.now();
        // this.count++;
        // if(this.count % (120 * 2) == 1){
        //     let rightVec = vec3.fromValues(0, 0, 3);
        //     vec3.cross(rightVec, this.scene.camera.forwardDirection, this.scene.camera.upDirection);
        //     console.log({
        //         cameraPos: this.scene.camera.position,
        //         cameraForwards: this.scene.camera.forwardDirection,
        //         cameraRight: rightVec,
        //         cameraUp: this.scene.camera.upDirection,
        //         sphereCount: this.scene.spheres.length,
        //     });            
        // }
        
        this.prepareScene();

        const commandEncoder: GPUCommandEncoder = this.device.createCommandEncoder();

        const ray_trace_pass: GPUComputePassEncoder = commandEncoder.beginComputePass();
        ray_trace_pass.setPipeline(this.ray_tracing_pipeline);
        ray_trace_pass.setBindGroup(0, this.ray_tracing_bind_group);
        ray_trace_pass.dispatchWorkgroups(this.canvas.width / 16, this.canvas.height / 16, 1);
        ray_trace_pass.end();

        const textureView: GPUTextureView = this.context.getCurrentTexture().createView();
        const renderpass: GPURenderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.5, g: 0.0, b: 0.25, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        renderpass.setPipeline(this.screen_pipeline);
        renderpass.setBindGroup(0, this.screen_bind_group);
        renderpass.draw(6, 1, 0, 0);

        renderpass.end();

        this.device.queue.submit([commandEncoder.finish()]);

        this.device.queue.onSubmittedWorkDone().then(
            () => {
                let end: number = performance.now();
                let performanceLabel: HTMLElement = <HTMLElement>document.getElementById("render-time");
                if (performanceLabel) {
                    performanceLabel.innerText = (end - start).toString();
                }
            }
        );

        requestAnimationFrame(this.render);

    }
}