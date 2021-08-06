import { Divider, Tab, Tabs, Typography } from "@material-ui/core";
import ProjectHistory from "component/ProjectHistory/ProjectHistory";
import React, { useState } from "react";
import { SmallFile } from "shared/icons";
import useStyles from "./styles";
const { ipcRenderer } = window.require("electron");
function ProjectHistoryTable(props) {
  const classes = useStyles();
  const [value, setValue] = useState(0);
  const [history, setHistory] = useState([]);
  const handleChange = (event, newValue) => {
    setValue(newValue);
  };
  ipcRenderer.on("getHistory", (event, data) => {
    setHistory(data);
  });
  ipcRenderer.on("searchProject", (event, data) => {
    setHistory(data);
  });
  return (
    <div className={classes.root}>
      <div className={classes.tabBar}>
        <Tabs value={value} onChange={handleChange} indicatorColor="secondary">
          <Tab label="Recently" />
          <Tab label="Oldest" />
        </Tabs>
      </div>
      <div className={classes.tableHead}>
        <div className={classes.columnContainer}>
          <div className={classes.fileIcon}>
            <SmallFile />
          </div>
          <Typography className={classes.nameColumn} align="left">
            Name project
          </Typography>
          <Typography align="left" className={classes.lastColumn}>
            Time upload
          </Typography>
        </div>
        <Divider variant="fullWidth" />
      </div>
      {history.map((project) => (
        <ProjectHistory
          projectName={project.name}
          percent={project.process}
          time={project.time}
        />
      ))}
    </div>
  );
}

export default ProjectHistoryTable;
