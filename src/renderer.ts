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
    randomSeed!:GPUBuffer;
    color_buffer!: GPUTexture;
    color_buffer_view!: GPUTextureView
    sampler!: GPUSampler
    sceneParameters!: GPUBuffer
    nodeBuffer!: GPUBuffer;
    // sphereBuffer!: GPUBuffer
    // sphereIndexBuffer!: GPUBuffer;
    triangleBuffer!: GPUBuffer;
    triangleIndexBuffer!: GPUBuffer;
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
                },
                {
                    binding: 7,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" },
                },
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

        this.randomSeed = this.device.createBuffer({
            label: "Camera Position Buffer",
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        }
        );

        // 球
        // const sphereBufferDescriptor: GPUBufferDescriptor = {
        //     size: 8 * this.scene.spheres.length * 4,
        //     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        // };
        // this.sphereBuffer = this.device.createBuffer(
        //     sphereBufferDescriptor
        // );

        // const sphereIndexBufferDescriptor: GPUBufferDescriptor = {
        //     size: 4 * this.scene.sphereCount,
        //     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        // };
        // this.sphereIndexBuffer = this.device.createBuffer(
        //     sphereIndexBufferDescriptor
        // );

        // 三角
        const triangleBufferDescriptor: GPUBufferDescriptor = {
            size: 64 * this.scene.triangleCount,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        };
        this.triangleBuffer = this.device.createBuffer(
            triangleBufferDescriptor
        );
        const triangleIndexBufferDescriptor: GPUBufferDescriptor = {
            size: 4 * this.scene.triangleCount,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        };
        this.triangleIndexBuffer = this.device.createBuffer(
            triangleIndexBufferDescriptor
        );

        const nodeBufferDescriptor: GPUBufferDescriptor = {
            label: 'nodeBuffer',
            size: 32 * this.scene.nodesUsed,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        };
        this.nodeBuffer = this.device.createBuffer(
            nodeBufferDescriptor
        );

        const urls = [
            "public/1/nx.png",  //x+
            "public/1/px.png",   //x-
            "public/1/ny.png",   //y+
            "public/1/py.png",  //y-
            "public/1/nz.png", //z+
            "public/1/pz.png",    //z-
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
                        buffer: this.triangleBuffer,
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
                        buffer: this.triangleIndexBuffer,
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
                {
                    binding: 7,
                    resource: {
                        buffer: this.randomSeed,
                    },
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
            triangleCount: this.scene.triangleCount,
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
                    sceneData.triangleCount
                ]
            ), 0, 16
        )

        const triangleData: Float32Array = new Float32Array(16 * this.scene.triangleCount);
        for (let i = 0; i < this.scene.triangleCount; i++) {
            for (var corner = 0; corner < 3; corner++) {
                for (var dimension = 0; dimension < 3; dimension++) {
                    triangleData[16*i + 4 * corner + dimension] = 
                        this.scene.triangles[i].corners[corner][dimension];
                }
                triangleData[16*i + 4 * corner + 3] = 0.0;
            }
            for (var channel = 0; channel < 3; channel++) {
                triangleData[16*i + 12 + channel] = this.scene.triangles[i].color[channel];
            }
            triangleData[16*i + 15] = 0.0;
        }
        this.device.queue.writeBuffer(this.triangleBuffer, 0, triangleData, 0, 16 * this.scene.triangleCount);

        const nodeData: Float32Array = new Float32Array(8 * this.scene.nodesUsed);
        for (let i = 0; i < this.scene.nodesUsed; i++) {
            nodeData[8 * i] = this.scene.nodes[i].minCorner[0];
            nodeData[8 * i + 1] = this.scene.nodes[i].minCorner[1];
            nodeData[8 * i + 2] = this.scene.nodes[i].minCorner[2];
            nodeData[8 * i + 3] = this.scene.nodes[i].leftChild;
            nodeData[8 * i + 4] = this.scene.nodes[i].maxCorner[0];
            nodeData[8 * i + 5] = this.scene.nodes[i].maxCorner[1];
            nodeData[8 * i + 6] = this.scene.nodes[i].maxCorner[2];
            nodeData[8 * i + 7] = this.scene.nodes[i].primitiveCount;
        }
        this.device.queue.writeBuffer(this.nodeBuffer, 0, nodeData, 0, 8 * this.scene.nodesUsed);

        const triangleIndexData: Float32Array = new Float32Array(this.scene.triangleCount);
        for (let i = 0; i < this.scene.triangleCount; i++) {
            triangleIndexData[i] = this.scene.triangleIndices[i];
        }
        this.device.queue.writeBuffer(this.triangleIndexBuffer, 0, triangleIndexData, 0, this.scene.triangleCount);
        
        this.device.queue.writeBuffer(this.randomSeed, 0, new Float32Array([Math.random()]));
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