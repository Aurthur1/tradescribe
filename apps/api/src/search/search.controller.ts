import { BadRequestException, Controller, Get, Module, Query, UseGuards } from "@nestjs/common";
import { z, ZodError } from "zod";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";

const SearchQuerySchema = z.object({
  accountId: z.string().optional(),
  q: z.string().trim().min(1).max(80)
});

type SearchQuery = z.infer<typeof SearchQuerySchema>;

type SearchTradeRow = {
  closeTime: Date;
  id: string;
  netProfit?: number;
  grossProfit: number;
  commission: number;
  swap: number;
  side: string;
  symbol: string;
};

type SearchNoteRow = {
  id: string;
  body: string;
  emotionTags: string[];
  trade: SearchTradeRow;
};

type SearchPlaybookRow = {
  color: string;
  description: string | null;
  id: string;
  name: string;
};

function parseQuery(query: unknown): SearchQuery {
  try {
    return SearchQuerySchema.parse(query);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        issues: error.issues.map((issue) => ({ message: issue.message, path: issue.path.join(".") })),
        message: "Validation failed"
      });
    }
    throw error;
  }
}

@Controller()
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get("search")
  async search(@CurrentUser("id") userId: string, @Query() rawQuery: unknown) {
    const query = parseQuery(rawQuery);
    const prisma = await this.prismaService.client();
    const q = query.q;
    const emotionCandidates = [...new Set([q, q.toUpperCase(), q.toLowerCase(), `${q.charAt(0).toUpperCase()}${q.slice(1).toLowerCase()}`])];

    const accountScope = query.accountId
      ? {
          id: query.accountId,
          brokerConnection: { userId }
        }
      : {
          brokerConnection: { userId }
        };

    const [trades, notes, playbooks] = (await prisma.$transaction([
      prisma.trade.findMany({
        where: {
          symbol: { contains: q, mode: "insensitive" },
          tradingAccount: accountScope
        },
        orderBy: { closeTime: "desc" },
        select: {
          closeTime: true,
          commission: true,
          grossProfit: true,
          id: true,
          side: true,
          swap: true,
          symbol: true
        },
        take: 5
      }),
      prisma.tradeNote.findMany({
        where: {
          OR: [{ body: { contains: q, mode: "insensitive" } }, { emotionTags: { hasSome: emotionCandidates } }],
          trade: { tradingAccount: accountScope }
        },
        orderBy: { updatedAt: "desc" },
        include: {
          trade: {
            select: {
              closeTime: true,
              commission: true,
              grossProfit: true,
              id: true,
              side: true,
              swap: true,
              symbol: true
            }
          }
        },
        take: 5
      }),
      prisma.playbook.findMany({
        where: {
          isArchived: false,
          name: { contains: q, mode: "insensitive" },
          userId
        },
        orderBy: { updatedAt: "desc" },
        select: {
          color: true,
          description: true,
          id: true,
          name: true
        },
        take: 5
      })
    ])) as [SearchTradeRow[], SearchNoteRow[], SearchPlaybookRow[]];

    return {
      notes: notes.map((note) => ({
        id: note.id,
        body: note.body,
        emotionTags: note.emotionTags,
        href: `/trades/${note.trade.id}`,
        trade: {
          closeTime: note.trade.closeTime,
          id: note.trade.id,
          netProfit: note.trade.grossProfit + note.trade.commission + note.trade.swap,
          side: note.trade.side,
          symbol: note.trade.symbol
        }
      })),
      playbooks: playbooks.map((playbook) => ({
        ...playbook,
        href: `/playbooks/${playbook.id}`
      })),
      trades: trades.map((trade) => ({
        closeTime: trade.closeTime,
        href: `/trades/${trade.id}`,
        id: trade.id,
        netProfit: trade.grossProfit + trade.commission + trade.swap,
        side: trade.side,
        symbol: trade.symbol
      }))
    };
  }
}

@Module({
  controllers: [SearchController],
  providers: [PrismaService]
})
export class SearchModule {}
