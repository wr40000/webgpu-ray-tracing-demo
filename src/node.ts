import { vec3 } from "gl-matrix"

// 球
// export class Node {
//     minCorner: vec3
//     leftChild: number
//     maxCorner: vec3
//     sphereCount: number
// }

// 三角
export class Node {
    minCorner!: vec3
    leftChild!: number
    maxCorner!: vec3
    primitiveCount!: number
}