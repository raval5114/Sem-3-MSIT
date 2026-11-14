const express = require("express");
const { getProfileData } = require("../service/user.service");

const router = express.Router();

/**
 * Standard REST API Endpoint for Web / Mobile Application
 * Defined in project.mcp_implementation_guide.md & project.endpoint.md
 * GET /api/users/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const data = await getProfileData(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve user profile",
    });
  }
});

module.exports = router;
