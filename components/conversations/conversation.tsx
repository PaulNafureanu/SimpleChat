import { Avatar, Badge, Box, Stack, Typography } from "@mui/material";
import ColorGenerator from "../../lib/ColorGenerator";
import StyledBadge from "../reusable/StyledBadge";

interface Props {
  id: number;
  label: string;
  name: string;
  account: string;
  photo: string;
}

const styles = {
  root: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  stack: {
    transition: "transform 0.3s",
    "&:hover": {
      transform: "scale(1.2)",
      cursor: "pointer",
    },
  },
  badge: {},
  avatar: {
    border: 2,
    borderColor: "#ffffff88",
    boxShadow: "0 0 16px #00000055",
  },
};

export default function Conversation({ name, label, id }: Props) {
  const initials = name.toUpperCase()[0];

  return (
    <Box sx={styles.root}>
      <Stack justifyContent="center" alignItems="center" sx={styles.stack}>
        <Badge
          overlap="circular"
          badgeContent={0}
          color="info"
          max={999}
          sx={styles.badge}
        >
          <StyledBadge
            overlap="circular"
            badgeContent=" "
            variant="dot"
            color="orange"
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
          >
            <Avatar
              sx={{
                ...styles.avatar,
                bgcolor: ColorGenerator.getColorByPrompt(name, { limit: 192 }),
              }}
              alt={name}
            >
              <Typography>{initials}</Typography>
            </Avatar>
          </StyledBadge>
        </Badge>
        <Typography>{label}</Typography>
      </Stack>
    </Box>
  );
}
