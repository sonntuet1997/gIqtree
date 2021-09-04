const { app, BrowserWindow, ipcMain, dialog, screen } = require("electron");
const fs = require("fs");
const path = require("path");
const isDev = require("electron-is-dev");
const child_process = require("child_process");
const os = require("os");

const homepage = require("./server/controller/homepage");
const { iqtreePath } = require("./server/db");
const { v4: uuidv4 } = require("uuid");
const { getOutputWhenExecuted } = require("./server/controller/execute");
const { viewFile } = require("./server/controller/file_handler");

let OBJECT_SETTING;

let mainWindow;
let inputFileName;
function createWindow() {
  const display = screen.getPrimaryDisplay();
  const dimensions = display.workAreaSize;
  mainWindow = new BrowserWindow({
    minWidth: 1440,
    minHeight: 600,
    width: dimensions.width,
    height: dimensions.height,
    maxWidth: dimensions.width,
    maxHeight: dimensions.height,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: `${__dirname}/assets/icon.ico`,
  });

  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  ipcMain.on("viewFile", (event, filePath) => {
    viewFile(filePath)
      .then((data) => {
        console.log({ readFile: data });
        mainWindow.webContents.send("viewFileData", data);
      })
      .catch((err) =>
        mainWindow.webContents.send("viewFileData", {
          message: "Does not read file",
        })
      );
  });

  ipcMain.handle("saveSetting", (event, object_model) => {
    OBJECT_SETTING = object_model;
    console.log({ OBJECT_SETTING });
  });

  ipcMain.handle("executeProject", async (event, project_id) => {
    let project_path;
    await homepage
      .getProjectById(project_id)
      .then((data) => {
        project_path = data[0].path;
      })
      .catch((err) => {
        console.log({ error: "does not get project path" });
      });

    console.log({ project_path });
    let execName = os.type() === "Windows_NT" ? "iqtree2.exe" : "iqtree2";
    let iqtreeExecute = path.join(iqtreePath, execName);
    let input_path = path.join(project_path, "input", inputFileName);
    let output_path = path.join(project_path, "output", "output");

    console.log("exec...");
    const COMMAND =
      os.type() === "Windows_NT"
        ? `${iqtreeExecute} -s ${input_path} -pre "${output_path}`
        : `chmod 755 "${iqtreeExecute}" &&  "${iqtreeExecute}" -s "${input_path}" -pre "${output_path}"`;
    await child_process.exec(COMMAND, async (err, stdout, stderr) => {
      if (err) {
        console.error(`exec error: ${err}`);
        return;
      }
      console.log("done");
      let data;
      await getOutputWhenExecuted(project_path)
        .then((result) => {
          data = result;
        })
        .catch((err) => {
          console.log({ errorExecuted: "does not get output" });
        });
      console.log({ data });
      event.sender.send("executeResult", data);
    });
  });

  ipcMain.on("selectDialog", async (event, project_id) => {
    try {
      // Step 1: Choose msa file and get path and name of it
      const filePath = dialog.showOpenDialogSync({
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "msa file", extensions: ["msa", "phy"] }],
      });
      if (!filePath) {
        mainWindow.webContents.send("cancelSelect", { canceled: 1 });
      } else {
        const fileName = filePath.map((element) => {
          console.log(element);
          let result;
          if (os.type() === "Windows_NT") {
            result = element.split("\\");
          } else {
            result = element.split("/");
          }
          return result[result.length - 1];
        });
        inputFileName = fileName[0];
        // Step 2: Copy input file into folder input of project
        let projectPath;
        await homepage.getProjectById(project_id).then((data) => {
          projectPath = path.join(data[0].path, "input");
        });

        for (let i = 0; i < filePath.length; i++) {
          let elementPath = path.join(projectPath, fileName[i]);
          fs.copyFile(filePath[i], elementPath, (err) => {
            if (err) throw err;
            else console.log("Copy successfully");
          });
        }

        setTimeout(() => {
          try {
            fs.readdir(projectPath, "utf-8", (err, files) => {
              if (err) throw err;
              let fileName = files.map((file) => {
                return {
                  name: file,
                  path: path.join(projectPath, file),
                };
              });
              console.log({ AAA: fileName });
              mainWindow.webContents.send("selectFile", {
                message: fileName,
                status: 1,
              });
            });
          } catch (err) {
            mainWindow.webContents.send("selectFile", {
              message: "File is exists",
              status: 0,
            });
          }
        }, 100);
      }
    } catch (err) {
      console.log({ err });
    }
  });

  ipcMain.on("getInputByProject", (event, project_id) => {
    try {
      homepage.getProjectById(project_id).then((data) => {
        console.log(data);
        const inputFolder = path.join(data[0].path, "input");
        console.log({ inputFolder });
        fs.readdir(inputFolder, "utf-8", (err, files) => {
          if (err) throw err;
          let fileName = files.map((file) => {
            return {
              name: file,
              path: path.join(inputFolder, file),
            };
          });
          console.log({ fileName });
          mainWindow.webContents.send("inputsOfProject", {
            message: fileName,
            status: 1,
          });
        });
      });
    } catch (err) {
      mainWindow.webContents.send("inputsOfProject", {
        message: "Error",
        status: 0,
      });
    }
  });

  ipcMain.on("deleteInput", async (event, inputData) => {
    const { input_name, project_id } = inputData;
    console.log(inputData);
    try {
      await homepage.getProjectById(project_id).then((data) => {
        let inputFile = path.join(data[0].path, "input", input_name);
        fs.unlinkSync(inputFile);
        mainWindow.webContents.send("deleteResult", {
          message: "Deleted",
          status: 1,
          name: input_name,
        });
      });
    } catch (err) {
      console.log("fail");
      mainWindow.webContents.send("deleteResult", {
        message: "Does not delete it",
        status: 0,
      });
    }
  });

  ipcMain.on("getHistory", (event) => {
    homepage.getHistory().then((data) => {
      mainWindow.webContents.send("returnHistory", data);
    });
  });
  ipcMain.on("openDir", async (event, name) => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `./${name}`,
    });
    mainWindow.webContents.send("openDirSuccess", { filePath });
  });

  ipcMain.on("setProject", (event, data) => {
    const { name, filePath, projectType } = data;
    if (!fs.existsSync(filePath)) {
      fs.mkdir(filePath, { recursive: true }, (err) => {
        if (err) throw err;
        else {
          console.log("created");
          const input = path.join(filePath, "input");
          const output = path.join(filePath, "output");
          fs.mkdir(input, { recursive: true }, (err) => {
            if (err) throw err;
            else console.log("Created input folder");
          });
          fs.mkdir(output, { recursive: true }, (err) => {
            if (err) throw err;
            else console.log("Created input folder");
          });
        }
      });
      let project_id = uuidv4();
      console.log(project_id);
      homepage
        .setProject(name, filePath, project_id, projectType)
        .then((data) => {
          mainWindow.webContents.send("setProjectSuccess", data);
        });
    }
  });

  ipcMain.on("getProjectById", (event, id) => {
    homepage.getProjectById(id).then((data) => {
      mainWindow.webContents.send("returnProjectById", data);
    });
  });

  ipcMain.on("search", (event, name) => {
    homepage.search(name).then((data) => {
      mainWindow.webContents.send("searchProject", data);
    });
  });
  mainWindow.on("closed", () => (mainWindow = null));
  ipcMain.on("minimizeApp", () => {
    console.log("sent");
    mainWindow.minimize();
  });
  ipcMain.on("maximizeApp", () => {
    mainWindow.maximize();
  });
  ipcMain.on("closeApp", () => {
    mainWindow.close();
  });
  ipcMain.on("unmaximizeApp", () => {
    mainWindow.unmaximize();
  });
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("maximize");
  });
  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("unmaximize");
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  // if (process.platform !== "darwin") {
  app.quit();
  app.exit();
  // }
});
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
