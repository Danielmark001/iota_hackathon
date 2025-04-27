import React from "react";
import {
  Box,
  Container,
  Typography,
  Link,
  Grid,
  Divider,
  IconButton,
} from "@mui/material";
import { GitHub, Twitter, Telegram } from "@mui/icons-material";

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: "auto",
        backgroundColor: (theme) =>
          theme.palette.mode === "light"
            ? theme.palette.grey[100]
            : theme.palette.grey[900],
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={3} justifyContent="space-between">
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              <span style={{ color: "#2196f3" }}>Intelli</span>
              <span>Lend</span>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AI-Powered DeFi Lending Platform on IOTA
            </Typography>
            <Box sx={{ mt: 2 }}>
              <IconButton
                href="https://github.com/Danielmark001/iota_hackathon"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <GitHub />
              </IconButton>
              <IconButton
                href="https://twitter.com/intellilend"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
              >
                <Twitter />
              </IconButton>
              <IconButton
                href="https://t.me/intellilend"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
              >
                <Telegram />
              </IconButton>
            </Box>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Resources
            </Typography>
            <Link
              href="https://docs.iota.org/"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              display="block"
              sx={{ mb: 1 }}
            >
              IOTA Documentation
            </Link>
            <Link
              href="https://evm.iota.org/"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              display="block"
              sx={{ mb: 1 }}
            >
              IOTA EVM
            </Link>
            <Link
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              display="block"
              sx={{ mb: 1 }}
            >
              API Docs
            </Link>
            <Link href="/faq" color="inherit" display="block" sx={{ mb: 1 }}>
              FAQs
            </Link>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Legal
            </Typography>
            <Link href="/terms" color="inherit" display="block" sx={{ mb: 1 }}>
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              color="inherit"
              display="block"
              sx={{ mb: 1 }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/disclaimer"
              color="inherit"
              display="block"
              sx={{ mb: 1 }}
            >
              Disclaimer
            </Link>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} IntelliLend. All rights reserved.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Built for the IOTA DefAI Hackathon
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
