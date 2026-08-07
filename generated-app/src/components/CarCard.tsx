import React from "react";
import { Card, CardContent, CardMedia, Typography } from "@mui/material";
import type { Car } from "@/types";

interface CarCardProps {
  car: Car;
}

const CarCard: React.FC<CarCardProps> = ({ car }) => {
  // Determine the correct image URL based on screen size
  const getImageUrl = () => {
    if (window.innerWidth < 600) return car.mobile;
    if (window.innerWidth < 1200) return car.tablet;
    return car.desktop;
  };

  return (
    <Card sx={{ maxWidth: 345, mb: 2 }}>
      <CardMedia
        component="img"
        height="140"
        image={getImageUrl()}
        alt={`${car.make} ${car.model}`}
      />
      <CardContent>
        <Typography variant="h6">
          {car.year} {car.make} {car.model}
        </Typography>
        <Typography color="text.secondary">{car.color}</Typography>
      </CardContent>
    </Card>
  );
};

export default CarCard;
