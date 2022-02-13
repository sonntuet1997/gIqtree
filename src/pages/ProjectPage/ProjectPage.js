import { Divider } from "@material-ui/core";
import { DialogContext } from "component/AlertDialog/AlertDialog";
import FolderTree from "container/FolderTree/FolderTree";
import ProjectInput from "container/ProjectInput/ProjectInput";
import ProjectSetting from "container/ProjectSetting/ProjectSetting";
import SettingDetail from "container/SettingDetail/SettingDetail";
import React, { useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getFileExtension } from "utils";
import { TREE_EXTENSION } from "utils/constant";
import useStyles from "./styles";
const { ipcRenderer } = window.require("electron");
export const PROJECT_STATUS = {
  NOT_EXECUTED: "NOT_EXECUTED",
  IN_PROCESS: "IN_PROCESS",
  IS_PAUSED: "IS_PAUSED",
  IN_PROCESS_AFTER_CONTINUE: "IN_PROCESS_AFTER_CONTINUE",
  IN_PROCESS_AFTER_RESTART: "IN_PROCESS_AFTER_RESTART",
  EXECUTED: "EXECUTED",
};
function ProjectPage(props) {
  const classes = useStyles();
  const { handleShowAlert } = useContext(DialogContext);

  const projectPath = useRef(null);
  const [projectStatus, setProjectStatus] = useState(null);
  const [currentFile, setCurrentFile] = useState("");
  const [isSettingOpen, setIsSettingOpen] = useState(true);
  const [listTrees, setListTrees] = useState([]);
  const [isExecuteDisabled, setIsExecuteDisabled] = useState(true);
  const [isPauseDisabled, setIsPauseDisabled] = useState(true);
  const [isContinueDisabled, setIsContinueDisabled] = useState(true);
  const [outputContent, setOutputContent] = useState(null);
  const { id } = useParams();
  const [projectName, setProjectName] = useState(null);
  const [projectSetting, setProjectSetting] = useState(null);
  const [progressLog, setProgressLog] = useState("");
  const [currentTree, setCurrentTree] = useState(1);
  const [currentTreeContent, setCurrentTreeContent] = useState("");
  const processId = useRef(null);
  const progress = useRef(null);
  useEffect(() => {
    switch (projectStatus) {
      case PROJECT_STATUS.NOT_EXECUTED:
        setIsExecuteDisabled(false);
        break;
      case PROJECT_STATUS.IN_PROCESS:
        ipcRenderer.invoke("executeProject", projectPath.current);
        setIsExecuteDisabled(true);
        setIsPauseDisabled(false);
        setIsContinueDisabled(true);
        setCurrentFile("");
        setOutputContent("");
        break;
      case PROJECT_STATUS.IS_PAUSED:
        ipcRenderer.send(
          "pauseProject",
          processId.current,
          projectPath.current
        );
        setIsExecuteDisabled(true);
        setIsPauseDisabled(true);
        setIsContinueDisabled(false);
        break;
      case PROJECT_STATUS.IN_PROCESS_AFTER_CONTINUE:
        ipcRenderer.invoke("continueProject", projectPath.current);
        setIsExecuteDisabled(true);
        setIsPauseDisabled(false);
        setIsContinueDisabled(true);
        setCurrentFile("");
        setOutputContent("");
        break;
      case PROJECT_STATUS.EXECUTED:
        ipcRenderer.send("getProjectById", id);
        setIsExecuteDisabled(false);
        setIsPauseDisabled(true);
        setIsContinueDisabled(true);
        break;
      case PROJECT_STATUS.IN_PROCESS_AFTER_RESTART:
        ipcRenderer.invoke("restartProject", projectPath.current);
        setIsExecuteDisabled(true);
        setIsPauseDisabled(false);
        setIsContinueDisabled(true);
        setCurrentFile("");
        setOutputContent("");
        break;
      default:
        break;
    }
  }, [handleShowAlert, id, projectStatus]);
  const handleSetProjectStatus = (status) => {
    setProjectStatus(status);
  };

  useEffect(() => {
    ipcRenderer.send("getProjectById", id);
    const viewFileData = (event, data) => {
      const { message, status } = data;
      if (status === 1) {
        setCurrentFile(message.name);
        setOutputContent(message.data);
        if (isSettingOpen) setIsSettingOpen(false);
      }
    };
    const saveSettingResult = (event, data) => {
      const { status, message } = data;
      console.log(data);
      if (status === 1) {
        ipcRenderer.send("getProjectById", id);
      }
    };
    const returnProjectById = (event, data) => {
      const { message, status } = data;
      if (status === 1) {
        if (!projectName) setProjectName(message.projectDetail.name);
        setProjectSetting(message.objectModel);
        projectPath.current = message.projectDetail.path;
        setListTrees(message.projectDetail.children);
        if (message.objectModel.data.alignment !== "") {
          console.log(message.objectModel.status);
          switch (message.objectModel.status) {
            case "Done":
              console.log(isSettingOpen);
              handleSetProjectStatus(PROJECT_STATUS.EXECUTED);
              break;
            case "Running":
              handleSetProjectStatus(PROJECT_STATUS.IN_PROCESS_AFTER_CONTINUE);
              break;
            case "Paused":
              setIsSettingOpen(false);
              handleSetProjectStatus(PROJECT_STATUS.IS_PAUSED);
              break;
            case "Empty":
              handleSetProjectStatus(PROJECT_STATUS.NOT_EXECUTED);
              break;
            default:
              return;
          }
        }

        // if (message.tree.input.length > 0)
        //   handleSetListInput(message.tree.input);
        // if (message.tree.output.length > 0)
        //   handleSetListOutput(message.tree.output);
      }
    };

    const executeResult = (event, data) => {
      data = JSON.parse(data);
      console.log({ data });
      processId.current = data.processId;
      setIsSettingOpen(false);
      handleGetProjectProgress();
      setCurrentFile("");
    };
    const getProgressResult = (event, data) => {
      if (data.status === 1) {
        setProgressLog(data.data);
        if (data.doneStatus === 1) {
          console.log(data);
          handleSetProjectStatus(PROJECT_STATUS.EXECUTED);
          // setIsSettingOpen(true);
        } else {
          console.log(data);
        }
      } else {
        handleShowAlert({
          title: "Error",
          message: "An error occured. Please try again!",
        });
      }
    };
    const pauseResult = (event, data) => {
      if (data.status === 1) {
        clearInterval(progress.current);
      }
    };
    ipcRenderer.on("returnProjectById", returnProjectById);
    ipcRenderer.on("viewFileData", viewFileData);
    ipcRenderer.on("saveSettingResult", saveSettingResult);
    ipcRenderer.on("testSettingResult", (event, data) => {});
    ipcRenderer.on("executeResult", executeResult);
    ipcRenderer.on("continueProjectResult", executeResult);
    ipcRenderer.on("restartProjectResult", executeResult);
    ipcRenderer.on("getProgressResult", getProgressResult);
    ipcRenderer.on("pauseResult", pauseResult);
    return () => {
      ipcRenderer.removeAllListeners();
      clearInterval(progress.current);
    };
  }, [id, projectName]); //get list input and get project name

  useEffect(() => {
    if (TREE_EXTENSION.includes(getFileExtension(currentFile))) {
      const treeContent = outputContent?.split(";")[currentTree - 1] || "";
      setCurrentTreeContent(treeContent);
    }
  }, [currentTree, currentTreeContent, outputContent]);

  const handleOpenSetting = () => {
    setIsSettingOpen(!isSettingOpen);
    // if (currentFile !== "") setCurrentFile("");
  };
  const handleCloseSetting = () => {
    setIsSettingOpen(false);
  };
  const handleGetOutputContent = (path) => {
    ipcRenderer.send("viewFile", path);
  };
  const handleGetProjectProgress = () => {
    ipcRenderer.send("getProgress", projectPath.current);
  };
  const handleTestSetting = (setting) => {
    ipcRenderer.invoke("testSetting", id, setting);
  };

  return (
    <div className={classes.root}>
      <ProjectSetting
        handleOpenSetting={handleOpenSetting}
        isExecuteDisabled={isExecuteDisabled}
        isContinueDisabled={isContinueDisabled}
        isPauseDisabled={isPauseDisabled}
        projectStatus={projectStatus}
        projectName={projectName}
        handleSetProjectStatus={handleSetProjectStatus}
      />
      <Divider variant="fullWidth" />
      <div className={classes.container}>
        <div className={classes.main}>
          {listTrees.length > 0 && (
            <FolderTree
              listTrees={listTrees}
              handleGetOutputContent={handleGetOutputContent}
              currentFile={currentFile}
            />
          )}
          <Divider orientation="vertical" className={classes.divider} />
          {!isSettingOpen && (
            <ProjectInput
              currentTreeContent={currentTreeContent}
              currentTree={currentTree}
              setCurrentTree={setCurrentTree}
              projectName={projectName}
              outputContent={outputContent}
              currentFile={currentFile}
              progressLog={progressLog}
              projectStatus={projectStatus}
              projectSetting={projectSetting}
            />
          )}
          {isSettingOpen && projectSetting && (
            <SettingDetail
              id={id}
              projectPath={projectPath.current}
              handleCloseSetting={handleCloseSetting}
              projectSetting={projectSetting}
              handleTestSetting={handleTestSetting}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectPage;
