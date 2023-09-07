import { Box } from "@mui/material";
import Category from "./category";
import getCategories from "@/services/getCategories";

import { cyan, blue, deepPurple, pink } from "@mui/material/colors";

const styles = {
  root: {
    backgroundColor: blue[900],
    height: `calc(100vh - 50px)`,
    color: "white",
    overflowY: "scroll",
    "&::-webkit-scrollbar": {
      width: "12px",
    },
    "&::-webkit-scrollbar-thumb": {
      transition: "background 3s",
      background: blue[800],
      borderLeft: 3,
      borderRight: 3,
      borderColor: blue[900],
      borderRadius: "2px",
    },
    "&::-webkit-scrollbar-track:hover": {
      // background: blue[900],
    },
    "&::-webkit-scrollbar-thumb:hover": {
      background: blue[600],
    },
  },
};

interface Props {}

export default function Conversations(props: Props) {
  // Simulate getting categories from the db/backend
  const categories = getCategories();

  return (
    <Box sx={styles.root}>
      {categories.map((category) => (
        <Category {...category} key={category.id} />
      ))}
    </Box>
  );
}
