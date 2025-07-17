import React from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import WorkIcon from "@mui/icons-material/Work";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MyLocationIcon from "@mui/icons-material/MyLocation";

const ICONS = {
  Home: <HomeIcon sx={{ color: "#31c48d" }} />,
  Work: <WorkIcon sx={{ color: "#fea44d" }} />,
  Other: <AddLocationAltIcon sx={{ color: "#1976d2" }} />,
  Current: <MyLocationIcon sx={{ color: "#FFD43B" }} />,
};

export default function AddressSelector({
  addresses = [],
  selectedAddressId,
  onSelect,
  onAddAddress,
  onEdit,
  onDelete,
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Delivery Address
      </Typography>
      <List sx={{ bgcolor: "#f6f8fa", borderRadius: 2, mb: 1 }}>
        {addresses.length === 0 && (
          <ListItem>
            <Button
              startIcon={<AddLocationAltIcon />}
              variant="contained"
              onClick={onAddAddress}
              fullWidth
            >
              Add New Address
            </Button>
          </ListItem>
        )}
        {addresses.map((address) => (
          <ListItem
            key={address.id}
            selected={selectedAddressId === address.id}
            sx={{
  bgcolor: selectedAddressId === address.id ? "#fffde7" : "#fff",
  border: selectedAddressId === address.id ? "2px solid #ffd43b" : "1px solid #eee",
  borderRadius: 3,
  mb: 1.5,
  minHeight: 70,
  boxShadow: selectedAddressId === address.id ? 3 : 0,
  transition: "all 0.18s",
  cursor: "pointer",
  p: 2,
  display: "flex",
  alignItems: "flex-start"
}}
            onClick={() => onSelect(address.id)}
            secondaryAction={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(address);
                  }}
                  aria-label="Edit Address"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  sx={{ ml: 0.5 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDelete) onDelete(address);
                  }}
                  aria-label="Delete Address"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            }
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Chip
                label={address.type}
                icon={ICONS[address.type] || ICONS["Other"]}
                size="small"
                sx={{ bgcolor: "#e0f2f1", color: "#17879c" }}
              />
            </ListItemIcon>
            <ListItemText
  primary={
    <span style={{ fontWeight: 700, fontSize: 15 }}>
      {address.name} {address.addressLine ? `, ${address.addressLine}` : ""}
    </span>
  }
  secondary={
    <span style={{ fontSize: 13, color: "#555" }}>
      {address.formatted
        ? address.formatted
        : address.addressLine}
      {/* Add floor, landmark if you use those */}
    </span>
  }
/>
          </ListItem>
        ))}
      </List>
      <Button
        startIcon={<AddLocationAltIcon />}
        variant="contained"
        color="primary"
        fullWidth
        onClick={onAddAddress}
        sx={{ mt: 1 }}
      >
        Add New Address
      </Button>
    </Box>
  );
}
