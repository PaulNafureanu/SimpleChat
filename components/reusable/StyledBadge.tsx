"use client";
import { Badge, styled } from "@mui/material";

const StyledBadge = styled(({ color, ...rest }: any) => (
  <Badge {...rest}>{rest.children}</Badge>
))(({ theme, color }) => ({
  "& .MuiBadge-badge": {
    backgroundColor: color || "#44b700",
    color: color || "#44b700",
    boxShadow: `0 0 0 2px #ffffff88`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": {
      transform: "scale(.8)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(2.4)",
      opacity: 0,
    },
  },
}));

export default StyledBadge;
