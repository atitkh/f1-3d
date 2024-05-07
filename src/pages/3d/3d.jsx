import React, { useEffect, useRef, Component } from 'react'
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import { Inspector } from "@babylonjs/inspector";

class MainScene extends Component {
    constructor(props) {
        super(props);
        this.mainTitle = null;
        this.canvasRef = React.createRef();

        this.engine = null;
        this.scene = null;
        this.mainCamera = null;

        // model/meshes
        this.sceneModelMeshes = null;
        this.loadingPercent = 0;
        this.progressMap = {};
        this.promiseArray = [];

        this.settings = {
            instructionMode: 1,
            enableGlow: false,
        }

        this.spotLight = null;
        this.spotLightPos = new BABYLON.Vector3(3.85, 4.05, -0.40);

        //joy stick
        this.UI = null;
    }

    loadingProgress(name, progress) {
        this.progressMap[name] = +progress;
        // calc precentage
        const sum = Object.keys(this.progressMap).reduce((prev, curr) => {
            return prev + this.progressMap[curr];
        }, 0);
        this.loadingPercent = Math.round(sum / Object.keys(this.progressMap).length);
        this.props.setLoadingPercent(this.loadingPercent);
        // console.log(`loading ${name}: ${progress}%`);
    }

    async componentDidMount() {
        this.engine = new BABYLON.Engine(this.canvasRef.current, true);
        this.scene = this.createScene();
        this.props.setScene(this.scene);

        //initialize loader and models
        this.loadingProgress("roomMeshes", 0);
        await this.loadModels();

        await this.setupEnvironment();

        this.engine.runRenderLoop(() => {
            let divFps = document.getElementsByClassName("fps")[0];
            divFps.innerHTML = this.engine.getFps().toFixed() + " fps";

            if (this.scene) {
                this.scene.render();
            }
        });

        this.canvasRef.current.focus();

        window.addEventListener("resize", () => {
            this.engine.resize();
        });

        Promise.all(this.promiseArray).then(() => {
            this.scene.executeWhenReady(() => {
                setTimeout(() => {
                    this.props.setLoading(false);
                }, 1000);
            });
        });

        this.optimizeScene(this.scene);
    }

    optimizeScene(scene, options) {
        options = new BABYLON.SceneOptimizerOptions()
        options.addOptimization(new BABYLON.HardwareScalingOptimization(0, 1))
        var optimizer = new BABYLON.SceneOptimizer(scene, options)
        optimizer.start()
        BABYLON.SceneOptimizer.OptimizeAsync(scene, BABYLON.SceneOptimizerOptions.HighDegradationAllowed(),
            () => {
                console.log("[OPTIMIZER] Scene optimized");
            }, () => {
                console.log("[OPTIMIZER] Scene optimization unsuccessfull");
            });
        return optimizer
    }

    componentWillUnmount() {
        this.engine.stopRenderLoop();
        this.engine.dispose();
    }

    createScene() {
        const scene = new BABYLON.Scene(this.engine);
        // new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 10, 0), scene);
        var light = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-1, -2, -1), scene);
        light.position = new BABYLON.Vector3(20, 40, 20);
        light.intensity = 1;

        var hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/Studio_Softbox_2Umbrellas_cube_specular.dds", scene);
        hdrTexture.name = "envTex";
        hdrTexture.gammaSpace = false;
        hdrTexture.setReflectionTextureMatrix(BABYLON.Matrix.RotationY(2.4));
        scene.environmentTexture = hdrTexture;

        // sky
        var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
        var skyboxMaterial = new BABYLON.PBRMaterial("skyBox", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = hdrTexture.clone();
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.microSurface = 1.0;
        skyboxMaterial.disableLighting = true;
        skyboxMaterial.twoSidedLighting = true;
        skyboxMaterial._environmentBRDFTexture = hdrTexture.clone();
        skyboxMaterial._environmentBRDFTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial._environmentBRDFTexture.gammaSpace = false;
        skybox.material = skyboxMaterial;

        // freely movable camera
        this.mainCamera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 100, 0), scene);
        this.mainCamera.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
        this.mainCamera.attachControl(this.canvasRef.current, true);
        this.mainCamera.checkCollisions = true;
        this.mainCamera.keysUp = [87]; // W
        this.mainCamera.keysDown = [83]; // S
        this.mainCamera.keysLeft = [65]; // A
        this.mainCamera.keysRight = [68]; // D
        scene.activeCamera = this.mainCamera;

        const framesPerSecond = 60;
        const gravity = -9.81;
        scene.gravity = new BABYLON.Vector3(0, gravity / framesPerSecond, 0);
        scene.collisionsEnabled = true;

        Inspector.Show(this.scene, { embedMode: false });

        return scene;
    }

    async loadModels() {
        BABYLON.SceneLoader.ShowLoadingScreen = false;
        // create large plane floor 
        var ground = BABYLON.Mesh.CreateGround("ground", 100, 100, 2, this.scene);
        ground.checkCollisions = true;
        ground.material = new BABYLON.StandardMaterial("groundMat", this.scene);
        ground.material.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        ground.material.specularColor = new BABYLON.Color3(0, 0, 0);
        ground.material.backFaceCulling = false;
        ground.material.alpha = 0.5;
        ground.material.freeze();
        ground.position.y = -0.01;
    }

    addGlow() {
        var glow = new BABYLON.GlowLayer("glow", this.scene, {
            mainTextureSamples: 4
        });
        //  only include meshes with name starting with frame
        let frameMeshes = this.sceneModelMeshes.filter((mesh) => {
            return mesh.name.startsWith("Cube.");
        });
        frameMeshes.forEach((mesh) => {
            mesh.material.emissiveColor = BABYLON.Color3.White();
            mesh.scaling.y += 0.01;
            mesh.scaling.z += 0.01;
        });
    }

    async setupEnvironment() {
    }

    render() {
        return (
            <>
                <canvas ref={this.canvasRef}
                    id="renderCanvas"
                    style={{ width: '100%', height: '100vh', display: 'block' }}
                />
            </>
        )
    }
}

export default MainScene;