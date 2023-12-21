struct Sphere{
    center: vec3<f32>,
    color: vec3<f32>,
    radius: f32,
}

struct Triangle {
    corner_a: vec3<f32>,
    //float
    normal_a: vec3<f32>,
    //float
    corner_b: vec3<f32>,
    //float
    normal_b: vec3<f32>,
    //float
    corner_c: vec3<f32>,
    //float
    normal_c: vec3<f32>,
    //float
    color: vec3<f32>,
    //float
}

struct ObjectData {
    triangles: array<Triangle>,
}

struct Node {
    minCorner: vec3<f32>,
    leftChild: f32,
    maxCorner: vec3<f32>,
    primitiveCount: f32,
}

struct BVH {
    nodes: array<Node>,
}

struct ObjectIndices {
    primitiveIndices: array<f32>,
}

struct Ray {
    direction: vec3<f32>,
    origin: vec3<f32>,
}

struct SceneData {
    cameraPos: vec3<f32>,
    cameraForwards: vec3<f32>,
    cameraRight: vec3<f32>,
    maxBounces: f32,
    cameraUp: vec3<f32>,
    primitiveCount: f32,
    inverseModel: mat4x4<f32>,
}

struct RenderState {
    t: f32,
    color: vec3<f32>,
    hit: bool,
    position: vec3<f32>,
    normal: vec3<f32>,
}

struct Camera {
  inverse_projection: mat4x4<f32>,
  inverse_view: mat4x4<f32>,
}

const SAMPLES = 5;

@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> scene: SceneData;
@group(0) @binding(2) var<storage, read> objects: ObjectData;
@group(0) @binding(3) var<storage, read> tree: BVH;
@group(0) @binding(4) var<storage, read> triangleLookup: ObjectIndices;
@group(0) @binding(5) var skyTexture: texture_cube<f32>;
@group(0) @binding(6) var skySampler: sampler;
@group(0) @binding(7) var<uniform> random_seed: f32;
@group(0) @binding(8) var<uniform> camera: Camera;



@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let screen_size: vec2<u32> = textureDimensions(color_buffer);
    let screen_pos : vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));

    let horizontal_coefficient: f32 = (f32(screen_pos.x) - f32(screen_size.x) / 2) / f32(screen_size.x);
    let vertical_coefficient: f32 = (f32(screen_pos.y) - f32(screen_size.y) / 2) / f32(screen_size.x);

    let forwards: vec3<f32> = scene.cameraForwards;
    let right: vec3<f32> = scene.cameraRight;
    let up: vec3<f32> = scene.cameraUp;

    //  <---
    let current_pixel = vec2<f32>(screen_pos);
    let pixel_center = (current_pixel + vec2(.5, .5)) / vec2<f32>(screen_size);

    // stands for normalized device coordinate
    let ndc: vec2<f32> = vec2(2., -2.) * pixel_center + vec2(-1., 1.);
    let ray_target: vec4<f32> = camera.inverse_projection * vec4<f32>(ndc.x, ndc.y, 1., 1.);
    let pixel_ray_direction: vec4<f32> = camera.inverse_view * vec4<f32>(
        normalize(vec3<f32>(ray_target.xyz) / ray_target.w),
        0.
    );
    //  --->

    var myRay: Ray;
    // myRay.direction = normalize(forwards + horizontal_coefficient * right + vertical_coefficient * up);
    myRay.direction = pixel_ray_direction.xyz;
    myRay.origin = scene.cameraPos;

    let pixel_color : vec3<f32> = rayColor(myRay, GlobalInvocationID.x);

    textureStore(color_buffer, screen_pos, vec4<f32>(pixel_color, 1.0));
}

fn rayColor(ray: Ray, id:u32) -> vec3<f32> {
    // var color: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0); 
    var color: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0); //my
    var result: RenderState;
    var lightDir: vec3<f32> = vec3<f32>(-1, -1, -1);

    var world_ray: Ray;
    var object_ray: Ray;
    world_ray.origin = ray.origin;
    world_ray.direction = ray.direction;
    
    // 第四分量为0: 向量，为1：标量
    object_ray.origin = (scene.inverseModel * vec4<f32>(ray.origin, 1.0)).xyz;
    object_ray.direction = (scene.inverseModel * vec4<f32>(ray.direction, 0.0)).xyz;

    let bounces: u32 = u32(scene.maxBounces);
    // for (var sample = 0u; sample < SAMPLES; sample++) {
        var multiplier: f32 = 1.0;
        for(var bounce: u32 = 0; bounce < bounces; bounce++){
            // temp_ray.origin += fract(sin(dot(
            //     vec2(f32(id)/exp2(14), random_seed),
            //     vec2(12.9898, 78.233)
            //     )) * 43758.5453)/100;
            result = trace(object_ray, lightDir, multiplier);
            //unpack color
            color += result.color * multiplier;   //my
            multiplier *= 0.5;

            //early exit
            if (!result.hit) {
                //sky color
                color = textureSampleLevel(skyTexture, skySampler, world_ray.direction, 0.0).xyz;
            }
            //Set up for next trace
            world_ray.origin = world_ray.origin + world_ray.direction * result.t;
            world_ray.direction = normalize(reflect(world_ray.direction, result.normal)); // 反射
            // world_ray.direction = normalize(refract(world_ray.direction, result.normal, f32(0.2))); // 折射
            
            object_ray.origin = (scene.inverseModel * vec4<f32>(world_ray.origin, 1.0)).xyz;
            object_ray.direction = (scene.inverseModel * vec4<f32>(world_ray.direction, 0.0)).xyz;
        }

        //Rays which reached terminal state and bounced indefinitely
        if (result.hit) {
            color = vec3(0.0, 0.0, 0.0);
        }
    // }
    //     color /= SAMPLES;
    //     color = sqrt(color); // gamma correction ??? idk
        
    return color;

}

fn trace(ray: Ray, lightDir: vec3<f32>, multiplier: f32) -> RenderState{

    //Set up the Render State
    var renderState: RenderState;
    renderState.color = vec3<f32>(0.0, 0.0, 0.0);
    var hitSomething: bool = false;
    var nearestHit: f32 = 9999;

    //Set up for BVH Traversal
    var node: Node = tree.nodes[0];
    var stack: array<Node, 15>;
    var stackLocation: u32 = 0;

    while(true){
        var primitiveCount:u32 = u32(node.primitiveCount);
        var contents: u32 = u32(node.leftChild);
        if(primitiveCount == 0){
            var child1: Node = tree.nodes[contents];
            var child2: Node = tree.nodes[contents + 1];

            var distance1:f32 = hit_aabb(ray, child1);
            var distance2:f32 = hit_aabb(ray, child2);

            if(distance1 > distance2){
                var tempDist: f32 = distance1;
                distance1 = distance2;
                distance2 = tempDist;

                var tempChild: Node = child1;
                child1 = child2;
                child2 = tempChild;
            }
            if(distance1 > nearestHit){
                if(stackLocation == 0){
                    break;
                }
                else{
                    stackLocation -= 1;
                    node = stack[stackLocation];
                }
            }
            else{
                node = child1;
                if(distance2 < nearestHit){
                    stack[stackLocation] = child2;
                    stackLocation += 1;
                }
            }
        }
        else{
            for(var i: u32 = 0; i < primitiveCount; i++){

                var newRenderState: RenderState = hit_triangle(
                    ray, 
                    objects.triangles[u32(triangleLookup.primitiveIndices[i + contents])], 
                    0.001, 
                    nearestHit, 
                    renderState,
                    lightDir,
                    multiplier);

                if(newRenderState.hit){
                    nearestHit = newRenderState.t;
                    renderState = newRenderState;
                    hitSomething = true;
                }
            }

            if (stackLocation == 0) {
                break;
            }
            else {
                stackLocation -= 1;
                node = stack[stackLocation];
            }
        }
    }

    return renderState;
}

fn hit_sphere(
        ray: Ray, 
        sphere: Sphere, 
        tMin: f32, 
        tMax: f32, 
        oldRenderState: RenderState, 
        lightDir: vec3<f32>,
        multiplier: f32
    ) -> RenderState{
    
    let co: vec3<f32> = ray.origin - sphere.center;
    let a: f32 = dot(ray.direction, ray.direction); 
    let b: f32 = 2.0 * dot(ray.direction, co);
    let c: f32 = dot(co, co) - sphere.radius * sphere.radius;
    let discriminant: f32 = b * b - 4.0 * a * c;

    var renderState: RenderState;
    renderState.color = oldRenderState.color;

    if(discriminant > 0.0){
        let t: f32  = (-b -sqrt(discriminant)) / (2 * a);

        if(t > tMin && t < tMax){
            renderState.position = ray.origin + t * ray.direction;
            renderState.normal = normalize(renderState.position - sphere.center);
            renderState.t = t;
            renderState.hit = true;
            // renderState.color = sphere.color;
            let light_dir = normalize(lightDir);
            let light_intensity: f32 = max(dot(renderState.normal, -light_dir), 0.0f); // cos(angle)
            renderState.color += sphere.color * light_intensity * multiplier;
            return renderState;
        }
    }

    renderState.hit = false;
    return renderState;
}

fn hit_triangle(
    ray: Ray, 
    tri: Triangle, 
    tMin: f32, 
    tMax: f32,
    oldRenderState: RenderState,
    lightDir: vec3<f32>,
    multiplier: f32
  )-> RenderState{
    //Set up a blank renderstate,
    //right now this hasn't hit anything
    var renderState: RenderState;
    renderState.color = oldRenderState.color;
    renderState.hit = false;

    //Direction vectors
    let edge_ab: vec3<f32> = tri.corner_b - tri.corner_a;
    let edge_ac: vec3<f32> = tri.corner_c - tri.corner_a;
    //Normal of the triangle
    var n: vec3<f32> = normalize(cross(edge_ab, edge_ac));
    var ray_dot_tri: f32 = dot(ray.direction, n);
    //backface reversal
    if (ray_dot_tri > 0.0) {
        ray_dot_tri = ray_dot_tri * -1;
        n = n * -1;
    }
    //early exit, ray parallel with triangle surface
    if (abs(ray_dot_tri) < 0.00001) {
        return renderState;
    }

    var system_matrix: mat3x3<f32> = mat3x3<f32>(
        ray.direction,
        tri.corner_a - tri.corner_b,
        tri.corner_a - tri.corner_c
    );
    let denominator: f32 = determinant(system_matrix);
    // 测试，太小不行
    if (abs(denominator) < 0.00001) {
        return renderState;
    }

    system_matrix = mat3x3<f32>(
        ray.direction,
        tri.corner_a - ray.origin,
        tri.corner_a - tri.corner_c
    );
    let u: f32 = determinant(system_matrix) / denominator;
    
    if (u < 0.0 || u > 1.0) {
        return renderState;
    }

    system_matrix = mat3x3<f32>(
        ray.direction,
        tri.corner_a - tri.corner_b,
        tri.corner_a - ray.origin,
    );
    let v: f32 = determinant(system_matrix) / denominator;
    if (v < 0.0 || u + v > 1.0) {
        return renderState;
    }

    system_matrix = mat3x3<f32>(
        tri.corner_a - ray.origin,
        tri.corner_a - tri.corner_b,
        tri.corner_a - tri.corner_c
    );
    let t: f32 = determinant(system_matrix) / denominator;

    if (t > tMin && t < tMax) {

        renderState.position = ray.origin + t * ray.direction;
        var normal: vec3<f32> = (1 - u - v) * tri.normal_a + u * tri.normal_b + v * tri.normal_c;
        renderState.normal = normalize(transpose(scene.inverseModel) * vec4<f32>(normal, 0.0)).xyz;     
        renderState.t = t;
        renderState.hit = true;
        // renderState.color = tri.color;
        let light_dir = normalize(lightDir);
        let light_intensity: f32 = max(dot(renderState.normal, -light_dir), 0.0f); // cos(angle)
        renderState.color += tri.color * light_intensity * multiplier;
        return renderState;
    }

    return renderState;

}

fn hit_aabb(ray: Ray, node: Node) -> f32 {
    var inverseDir: vec3<f32> = vec3(1.0) / ray.direction;
    var t1: vec3<f32> = (node.minCorner - ray.origin) * inverseDir;
    var t2: vec3<f32> = (node.maxCorner - ray.origin) * inverseDir;
    var tMin: vec3<f32> = min(t1, t2); // 取所有维度的最小值
    var tMax: vec3<f32> = max(t1, t2);  // 取所有维度的最大值

    var t_min: f32 = max(max(tMin.x, tMin.y), tMin.z);
    var t_max: f32 = min(min(tMax.x, tMax.y), tMax.z);

    if (t_min > t_max || t_max < 0) {
        return 99999;
    }
    else {
        return t_min;
    }
}