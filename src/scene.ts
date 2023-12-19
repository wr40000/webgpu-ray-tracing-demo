import { Camera } from './camera'
import { Sphere } from './sphere'
import { Node } from './node';
import { vec3 } from 'gl-matrix';
import { Triangle } from './triangle'

export class Scene {
    camera: Camera;
    
    // spheres: Sphere[];
    // sphereCount: number;
    // sphereIndices!: number[];
    
    triangles: Triangle[]
    triangleCount: number
    triangleIndices!: number[]

    nodes!: Node[];
    nodesUsed: number = 0;

    constructor(canvas: HTMLCanvasElement, triangleCount: number) {

        // 球
        // this.spheres = new Array(sphereCount);
        // this.sphereCount = sphereCount;
        // for (let i = 0; i < this.spheres.length; i++) {
        //     const center = [
        //         (Math.random() - 0.5) * 10, // x
        //         (Math.random() - 0.5) * 10, //y
        //         Math.random() * 10, // z
        //     ];
        //     const radius = 1;
        //     const color = [
        //         Math.abs(Math.random()),
        //         Math.abs(Math.random()),
        //         Math.abs(Math.random()),
        //         // 1.0,
        //         // 1.0,
        //         // 1.0,
        //     ]
        //     const sphere = new Sphere(center, radius, color);

        //     this.spheres[i] = sphere;
        // }

        // 三角
        this.triangleCount = triangleCount;
        this.triangles = new Array(triangleCount);
        for (let i = 0; i < this.triangles.length; i++) {

            const center: vec3 = [
                -50 + 100.0 * Math.random(),
                -50.0 + 100.0 * Math.random(),
                -50.0 + 100.0 * Math.random()
            ];

            const offsets: vec3[] =
                [
                    [
                        -3 + 6 * Math.random(),
                        -3 + 6 * Math.random(),
                        -3 + 6 * Math.random()
                    ],
                    [
                        -3 + 6 * Math.random(),
                        -3 + 6 * Math.random(),
                        -3 + 6 * Math.random()
                    ],
                    [
                        -3 + 6 * Math.random(),
                        -3 + 6 * Math.random(),
                        -3 + 6 * Math.random()
                    ]
                ];

            const color: vec3 = [
                0.3 + 0.7 * Math.random(),
                0.3 + 0.7 * Math.random(),
                0.3 + 0.7 * Math.random()
            ];

            this.triangles[i] = new Triangle();
            this.triangles[i].build_from_center_and_offsets(center, offsets, color);
        }
        this.camera = new Camera(canvas, Math.PI / 4, 0.1, 10000, 0.01)

        this.buildBVH()
    }

    // 球的BVH
    // buildBVH() {

    //     this.sphereIndices = new Array(this.spheres.length)
    //     for (var i: number = 0; i < this.sphereCount; i += 1) {
    //         this.sphereIndices[i] = i;
    //     }

    //     this.nodes = new Array(2 * this.spheres.length - 1);
    //     for (var i: number = 0; i < 2 * this.spheres.length - 1; i += 1) {
    //         this.nodes[i] = new Node();
    //     }

    //     var root: Node = this.nodes[0];
    //     root.leftChild = 0;
    //     root.sphereCount = this.spheres.length;
    //     // this.nodesUsed：表示已经使用的节点数量，也可以看作是当前已经创建的包围盒节点的索引在构建 BVH 树的过程中，
    //     //  每创建一个新的节点，nodesUsed 就会增加。
    //     this.nodesUsed += 1
    //     // updateBounds(index)： 更新对应索引为index包围盒的边界
    //     this.updateBounds(0);
    //     //在更新完updateBounds(index)对应索引为index的包围盒的边界后，再去递归划分基于索引为index的
    //     // 包围盒的空间
    //     this.subdivide(0);
    // }

    // updateBounds(nodeIndex: number) {

    //     var node: Node = this.nodes[nodeIndex];
    //     node.minCorner = [999999, 999999, 999999];
    //     node.maxCorner = [-999999, -999999, -999999];

    //     // 遍历当前包围盒中的所有球体，通过比较得出这些球体的最大和最小边界，以更新当前包围盒的
    //     //  node.minCorner 和 node.maxCorner
    //     for (var i: number = 0; i < node.sphereCount; i += 1) {
    //         const sphere: Sphere = this.spheres[this.sphereIndices[node.leftChild + i]];
    //         const axis: vec3 = [sphere.radius, sphere.radius, sphere.radius];

    //         var temp: vec3 = [0, 0, 0]
    //         vec3.subtract(temp, sphere.center, axis);
    //         vec3.min(node.minCorner, node.minCorner, temp);

    //         vec3.add(temp, sphere.center, axis);
    //         vec3.max(node.maxCorner, node.maxCorner, temp);
    //     }
    // }

    // subdivide(nodeIndex: number) {
    //     // 处理索引为nodeIndex的包围盒节点
    //     var node: Node = this.nodes[nodeIndex];

    //     if (node.sphereCount <= 2) {
    //         return;
    //     }

    //     // extent 表示包围盒节点在选定的轴上的范围大小。具体而言，extent 是通过计算包围盒节点的最大值和
    //     // 最小值之差得到的向量。在 subdivide 函数中，选择划分的轴是基于包围盒节点在三个轴上的范围大小来
    //     // 决定的。extent 的作用是帮助选择最大的轴。通过比较在不同轴上的 extent，选择范围最大的轴来进行
    //     // 划分，这有助于保持每个子节点的空间分布较为均匀，从而提高 BVH 的效果。
    //     var extent: vec3 = [0, 0, 0];
    //     vec3.subtract(extent, node.maxCorner, node.minCorner);
    //     var axis: number = 0;
    //     // 分量大 =》 轴长？
    //     if (extent[1] > extent[axis]) {
    //         axis = 1;
    //     }
    //     if (extent[2] > extent[axis]) {
    //         axis = 2;
    //     }

    //     // 包围盒最长边的长度的一半
    //     const splitPosition: number = node.minCorner[axis] + extent[axis] / 2;


    //     // 快速排序，将以最长轴的一般为边界，将该包围盒内部的球体划分为两部分
    //     // 结束后sphereIndices数组里的球体排序就是按照最小边界逐渐增大的顺序排列的了
    //     debugger
    //     var i: number = node.leftChild;
    //     var j: number = i + node.sphereCount - 1;

    //     while (i <= j) {
    //         if (this.spheres[this.sphereIndices[i]].center[axis] < splitPosition) {
    //             i += 1;
    //         }
    //         else {
    //             var temp: number = this.sphereIndices[i];
    //             this.sphereIndices[i] = this.sphereIndices[j];
    //             this.sphereIndices[j] = temp;
    //             j -= 1;
    //         }
    //     }
    //     var leftCount: number = i - node.leftChild;
    //     if (leftCount == 0 || leftCount == node.sphereCount) {
    //         return;
    //     }

    //     const leftChildIndex: number = this.nodesUsed;
    //     this.nodesUsed += 1;
    //     const rightChildIndex: number = this.nodesUsed;
    //     this.nodesUsed += 1;

    //     // leftCount：
    //     //  1> 非叶子节点：划分后偏小的包围盒的索引
    //     //  1> 叶子节点：划分后偏小的包围盒的最小边界对应的球体的索引
    //     this.nodes[leftChildIndex].leftChild = node.leftChild;
    //     this.nodes[leftChildIndex].sphereCount = leftCount;

    //     // 划分后偏大的包围盒的最小边界对应的球体的索引
    //     this.nodes[rightChildIndex].leftChild = i;
    //     this.nodes[rightChildIndex].sphereCount = node.sphereCount - leftCount;

    //     node.leftChild = leftChildIndex;
    //     node.sphereCount = 0;

    //     this.updateBounds(leftChildIndex);
    //     this.updateBounds(rightChildIndex);
    //     this.subdivide(leftChildIndex);
    //     this.subdivide(rightChildIndex);
    // }

    // 三角形的BVH
    buildBVH() {

        this.triangleIndices = new Array(this.triangles.length)
        for (var i: number = 0; i < this.triangleCount; i += 1) {
            this.triangleIndices[i] = i;
        }

        this.nodes = new Array(2 * this.triangles.length - 1);
        for (var i: number = 0; i < 2 * this.triangles.length - 1; i += 1) {
            this.nodes[i] = new Node();
        }

        var root: Node = this.nodes[0];
        root.leftChild = 0;
        root.primitiveCount = this.triangles.length;
        this.nodesUsed += 1

        this.updateBounds(0);
        this.subdivide(0);
    }

    updateBounds(nodeIndex: number) {

        var node: Node = this.nodes[nodeIndex];
        node.minCorner = [999999, 999999, 999999];
        node.maxCorner = [-999999, -999999, -999999];

        for (var i: number = 0; i < node.primitiveCount; i += 1) {
            const triangle: Triangle = this.triangles[this.triangleIndices[node.leftChild + i]];

            triangle.corners.forEach(
                (corner: vec3) => {

                    vec3.min(node.minCorner, node.minCorner, corner);
                    vec3.max(node.maxCorner, node.maxCorner, corner);
                }
            )
        }
    }

    subdivide(nodeIndex: number) {

        var node: Node = this.nodes[nodeIndex];

        if (node.primitiveCount <= 2) {
            return;
        }

        var extent: vec3 = [0, 0, 0];
        vec3.subtract(extent, node.maxCorner, node.minCorner);
        var axis: number = 0;
        if (extent[1] > extent[axis]) {
            axis = 1;
        }
        if (extent[2] > extent[axis]) {
            axis = 2;
        }

        const splitPosition: number = node.minCorner[axis] + extent[axis] / 2;

        var i: number = node.leftChild;
        var j: number = i + node.primitiveCount - 1;

        while (i <= j) {
            if (this.triangles[this.triangleIndices[i]].centroid[axis] < splitPosition) {
                i += 1;
            }
            else {
                var temp: number = this.triangleIndices[i];
                this.triangleIndices[i] = this.triangleIndices[j];
                this.triangleIndices[j] = temp;
                j -= 1;
            }
        }

        var leftCount: number = i - node.leftChild;
        if (leftCount == 0 || leftCount == node.primitiveCount) {
            return;
        }

        const leftChildIndex: number = this.nodesUsed;
        this.nodesUsed += 1;
        const rightChildIndex: number = this.nodesUsed;
        this.nodesUsed += 1;

        this.nodes[leftChildIndex].leftChild = node.leftChild;
        this.nodes[leftChildIndex].primitiveCount = leftCount;

        this.nodes[rightChildIndex].leftChild = i;
        this.nodes[rightChildIndex].primitiveCount = node.primitiveCount - leftCount;

        node.leftChild = leftChildIndex;
        node.primitiveCount = 0;

        this.updateBounds(leftChildIndex);
        this.updateBounds(rightChildIndex);
        this.subdivide(leftChildIndex);
        this.subdivide(rightChildIndex);
    }

}