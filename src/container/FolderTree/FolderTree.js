import { Typography } from "@material-ui/core";
import React, { useState } from "react";
import useStyles from "./styles";
const { ipcRenderer } = window.require("electron");

function FolderTree(props) {
  const classes = useStyles();
  const [listName, setListName] = useState([]);
  ipcRenderer.on("selectFile", (event, data) => {
    const { fileName } = data.message;
    if (fileName) setListName([...listName, fileName]);
  });
  return (
    <div className={classes.root}>
      <div className={classes.container}>
        <div className={classes.inputAndOutputContainer}>
          <Typography className={classes.title} color="secondary">
            Input
          </Typography>
          {listName.length > 0 &&
            listName.map((name, index) => (
              <Typography className={classes.fileName} key={index}>
                {name}
              </Typography>
            ))}
        </div>
        <div className={classes.inputAndOutputContainer}>
          <Typography className={classes.title} color="secondary">
            Output
          </Typography>
        </div>
      </div>
    </div>
  );
}

export default FolderTree;
