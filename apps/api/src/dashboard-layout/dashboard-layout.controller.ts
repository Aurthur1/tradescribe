import { BadRequestException, Body, Controller, Get, Module, Put, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";

const LayoutItemSchema = z.object({
  order: z.number().int().min(0),
  size: z.enum(["sm", "md", "lg"]),
  visible: z.boolean(),
  widgetId: z.string().min(1).max(80)
});

const DashboardLayoutSchema = z.object({
  layout: z.array(LayoutItemSchema).max(50)
});

type DashboardLayoutBody = z.infer<typeof DashboardLayoutSchema>;

interface DashboardLayoutRow {
  layout: unknown;
  updatedAt: Date;
}

@Controller("me/dashboard-layout")
@UseGuards(AuthGuard)
export class DashboardLayoutController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getLayout(@CurrentUser("id") userId: string) {
    const prisma = await this.prismaService.client();
    const row = (await prisma.dashboardLayout.findUnique({
      where: { userId }
    })) as DashboardLayoutRow | null;

    return {
      layout: row?.layout ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null
    };
  }

  @Put()
  async putLayout(@CurrentUser("id") userId: string, @Body() payload: unknown) {
    const result = DashboardLayoutSchema.safeParse(payload);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const body: DashboardLayoutBody = result.data;
    const prisma = await this.prismaService.client();
    const row = (await prisma.dashboardLayout.upsert({
      create: { layout: body.layout, userId },
      update: { layout: body.layout },
      where: { userId }
    })) as DashboardLayoutRow;

    return {
      layout: row.layout,
      updatedAt: row.updatedAt.toISOString()
    };
  }
}

@Module({
  controllers: [DashboardLayoutController],
  providers: [PrismaService]
})
export class DashboardLayoutModule {}
