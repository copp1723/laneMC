import type { Express } from "express";
import { authenticateToken, AuthRequest } from "../services/auth";
import { campaignGeneratorService } from "../services/campaign-generator";
import { storage } from "../storage";

export function registerCampaignGeneratorRoutes(app: Express): void {
  
  // Generate campaign from brief
  app.post("/api/campaign-briefs/:briefId/generate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { briefId } = req.params;
      
      const generatedCampaign = await campaignGeneratorService.generateCampaignFromBrief(briefId);
      
      res.json({
        success: true,
        campaign: generatedCampaign
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // Get campaign implementation instructions (READ-ONLY)
  app.post("/api/campaign-briefs/:briefId/implementation-guide", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { briefId } = req.params;

      // Get the brief with generated campaign data
      const brief = await storage.getCampaignBrief(briefId);
      if (!brief) {
        return res.status(404).json({ message: "Campaign brief not found" });
      }

      if (!brief.generatedCampaign) {
        return res.status(400).json({ message: "No generated campaign found. Generate campaign first." });
      }

      // Mark as ready for implementation (but don't actually create in Google Ads)
      await storage.updateCampaignBrief(briefId, {
        status: 'ready_for_implementation'
      });

      res.json({
        success: true,
        campaignStructure: brief.generatedCampaign,
        implementationInstructions: {
          message: "Campaign structure generated successfully. Please implement manually in Google Ads.",
          steps: [
            "1. Log into your Google Ads account",
            "2. Create a new campaign using the provided structure",
            "3. Set up ad groups as specified",
            "4. Add keywords with suggested match types",
            "5. Create ads using the provided copy",
            "6. Set budget and bidding strategy as recommended",
            "7. Configure targeting settings",
            "8. Review and launch when ready"
          ]
        }
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // Get campaign generation status
  app.get("/api/campaign-briefs/:briefId/generation-status", authenticateToken, async (req, res) => {
    try {
      const { briefId } = req.params;
      
      const brief = await storage.getCampaignBrief(briefId);
      if (!brief) {
        return res.status(404).json({ message: "Campaign brief not found" });
      }

      res.json({
        briefId: brief.id,
        status: brief.status,
        hasGeneratedCampaign: !!brief.generatedCampaign,
        generatedCampaign: brief.generatedCampaign
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Stream campaign generation (for real-time updates)
  app.post("/api/campaign-briefs/:briefId/generate-stream", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { briefId } = req.params;
      
      // Set headers for streaming
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const brief = await storage.getCampaignBrief(briefId);
      if (!brief) {
        res.write('Error: Campaign brief not found');
        res.end();
        return;
      }

      res.write('Starting campaign generation...\n');

      try {
        const generatedCampaign = await campaignGeneratorService.generateCampaignFromBrief(briefId);
        
        res.write('\nCampaign generation completed!\n');
        res.write(`Generated campaign: ${JSON.stringify(generatedCampaign, null, 2)}\n`);
        
      } catch (error: any) {
        res.write(`\nError generating campaign: ${error.message}\n`);
      }
      
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}