import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import type { CreateServiceCategoryInput, CreateServiceInput, UpdateServiceInput } from "./service.types.js";
import { pricesChanged, type PriceHistoryKind, type PriceHistoryRow } from "./service.priceHistory.js";

type SportFlags = {
  isBadminton: boolean;
  isTennis: boolean;
  isPickleball: boolean;
  isFootball: boolean;
  isBasketball: boolean;
  isVolleyball: boolean;
};

// Brand names used by the seed data to tag gear to a specific sport (e.g. "Vớ Thể Thao Yonex"
// carries no literal sport word but Yonex is only ever used for badminton items in this catalog).
export function detectSportFromText(text: string): SportFlags {
  const t = text.toLowerCase();
  return {
    isBadminton: t.includes("cầu lông") || t.includes("badminton") || t.includes("yonex"),
    isTennis: t.includes("tennis") || t.includes("wilson") || t.includes("babolat"),
    isPickleball: t.includes("pickleball") || t.includes("selkirk") || t.includes("franklin"),
    isFootball: t.includes("bóng đá") || t.includes("football") || t.includes("futsal") || t.includes("soccer"),
    isBasketball: t.includes("bóng rổ") || t.includes("basketball") || t.includes("molten"),
    isVolleyball: t.includes("bóng chuyền") || t.includes("volleyball") || t.includes("mikasa")
  };
}

function hasAnySport(sport: SportFlags) {
  return sport.isBadminton || sport.isTennis || sport.isPickleball || sport.isFootball || sport.isBasketball || sport.isVolleyball;
}

function sportsIntersect(a: SportFlags, b: SportFlags) {
  return (
    (a.isBadminton && b.isBadminton) ||
    (a.isTennis && b.isTennis) ||
    (a.isPickleball && b.isPickleball) ||
    (a.isFootball && b.isFootball) ||
    (a.isBasketball && b.isBasketball) ||
    (a.isVolleyball && b.isVolleyball)
  );
}

// A service whose name implies a specific sport (by keyword or brand) only belongs on courts of
// that sport. Items with no detectable sport (drinks, food, generic combos) are always allowed,
// and a court whose own sport we couldn't detect is left unfiltered rather than hiding everything.
function isServiceAllowedForSport(serviceName: string, courtSport: SportFlags) {
  const itemSport = detectSportFromText(serviceName);
  const isRacketItem = serviceName.toLowerCase().includes("vợt");
  if (!hasAnySport(itemSport) && !isRacketItem) return true;
  if (!hasAnySport(courtSport)) return true;
  if (isRacketItem && !hasAnySport(itemSport)) {
    return courtSport.isBadminton || courtSport.isTennis || courtSport.isPickleball;
  }
  return sportsIntersect(itemSport, courtSport);
}

let initPromise: Promise<void> | null = null;

async function runServiceTableInit() {
  try {
    const statements = [
      `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
      `ALTER TABLE courts ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS court_id VARCHAR(50);`,
      `CREATE SEQUENCE IF NOT EXISTS seq_services;`,
      `CREATE TABLE IF NOT EXISTS service_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(20) PRIMARY KEY DEFAULT ('sv' || lpad(nextval('seq_services')::text, 4, '0')),
        partner_id VARCHAR(50) NOT NULL,
        category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'PRODUCT',
        sport_type VARCHAR(50),
        price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        original_price DECIMAL(12, 2),
        cost_price DECIMAL(12, 2) DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'lon',
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        track_inventory BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS court_services (
        id VARCHAR(20) PRIMARY KEY,
        court_id VARCHAR(20) NOT NULL,
        service_id VARCHAR(20) REFERENCES services(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        price_override DECIMAL(12, 2),
        is_available BOOLEAN DEFAULT TRUE,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = current_schema()
             AND table_name = 'booking_services'
             AND column_name = 'service_id'
             AND (data_type <> 'character varying' OR character_maximum_length IS DISTINCT FROM 100)
         ) THEN
           ALTER TABLE booking_services ALTER COLUMN service_id TYPE VARCHAR(100);
         END IF;
       END $$;`,
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = current_schema()
             AND table_name = 'booking_services'
             AND column_name = 'court_service_id'
             AND (data_type <> 'character varying' OR character_maximum_length IS DISTINCT FROM 100)
         ) THEN
           ALTER TABLE booking_services ALTER COLUMN court_service_id TYPE VARCHAR(100);
         END IF;
       END $$;`,
      `ALTER TABLE booking_services DROP CONSTRAINT IF EXISTS booking_services_service_id_fkey;`,
      // When a service's sale or cost price was set, from what and by whom (service.priceHistory.ts). Append-only:
      // a row is never edited, except that the person who made the change is cleared if their account is deleted.
      // database/39_service_price_history.sql adds the same and records each existing service's starting price.
      `CREATE SEQUENCE IF NOT EXISTS seq_service_price_history;`,
      `CREATE TABLE IF NOT EXISTS service_price_history (
        id VARCHAR(20) PRIMARY KEY DEFAULT ('sph' || lpad(nextval('seq_service_price_history')::text, 5, '0')),
        service_id VARCHAR(20) NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        kind VARCHAR(10) NOT NULL CHECK (kind IN ('INITIAL', 'CREATED', 'CHANGED')),
        old_price DECIMAL(12, 2),
        new_price DECIMAL(12, 2) NOT NULL CHECK (new_price >= 0),
        old_cost_price DECIMAL(12, 2),
        new_cost_price DECIMAL(12, 2) NOT NULL CHECK (new_cost_price >= 0),
        changed_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT service_price_history_change_has_old CHECK (kind <> 'CHANGED' OR (old_price IS NOT NULL AND old_cost_price IS NOT NULL))
      );`,
      `CREATE INDEX IF NOT EXISTS idx_service_price_history_service ON service_price_history(service_id, changed_at DESC);`,
      `CREATE OR REPLACE FUNCTION prevent_service_price_history_mutation()
       RETURNS trigger AS $$
       BEGIN
         IF NEW.changed_by IS NULL AND OLD.changed_by IS NOT NULL
            AND (NEW.id, NEW.service_id, NEW.kind, NEW.old_price, NEW.new_price, NEW.old_cost_price, NEW.new_cost_price, NEW.changed_at)
                IS NOT DISTINCT FROM (OLD.id, OLD.service_id, OLD.kind, OLD.old_price, OLD.new_price, OLD.old_cost_price, OLD.new_cost_price, OLD.changed_at) THEN
           RETURN NEW;
         END IF;
         RAISE EXCEPTION 'service_price_history is append-only; UPDATE is not allowed';
       END;
       $$ LANGUAGE plpgsql;`,
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_price_history_immutable') THEN
           CREATE TRIGGER trg_service_price_history_immutable
           BEFORE UPDATE ON service_price_history
           FOR EACH ROW EXECUTE FUNCTION prevent_service_price_history_mutation();
         END IF;
       END $$;`,
      `CREATE INDEX IF NOT EXISTS idx_services_court_id ON services(court_id);`,
      `CREATE INDEX IF NOT EXISTS idx_court_services_court_id ON court_services(court_id);`
    ];

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    console.log("[ServiceRepository] Schema & categories checked/initialized.");
  } catch (err) {
    initPromise = null;
    console.error("[ServiceRepository] Table setup failed:", err);
    throw err;
  }
}

export function ensureServiceTables(): Promise<void> {
  if (!initPromise) initPromise = runServiceTableInit();
  return initPromise;
}

async function serviceUsed(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ used: boolean }>>`
    SELECT (
      EXISTS (
        SELECT 1 FROM booking_services bs
        WHERE bs.service_id = ${id}
           OR bs.court_service_id IN (SELECT cs.id FROM court_services cs WHERE cs.service_id = ${id})
      )
      OR EXISTS (SELECT 1 FROM rental_items WHERE service_id = ${id})
      OR EXISTS (SELECT 1 FROM purchase_order_items WHERE service_id = ${id})
      OR EXISTS (SELECT 1 FROM inventory_transactions WHERE service_id = ${id} AND reference_type IS DISTINCT FROM 'INITIAL_STOCK')
    ) AS used
  `;
  return Boolean(rows[0]?.used);
}

/** One line of a service's price history, in the transaction that set the price. */
async function recordPrice(
  tx: Prisma.TransactionClient,
  entry: {
    serviceId: string;
    kind: PriceHistoryKind;
    oldPrice: number | null;
    newPrice: number;
    oldCostPrice: number | null;
    newCostPrice: number;
    changedBy: string | null;
  }
) {
  await tx.$executeRaw`
    INSERT INTO service_price_history (service_id, kind, old_price, new_price, old_cost_price, new_cost_price, changed_by)
    VALUES (${entry.serviceId}, ${entry.kind}, ${entry.oldPrice}, ${entry.newPrice}, ${entry.oldCostPrice}, ${entry.newCostPrice}, ${entry.changedBy})
  `;
}

export const serviceRepository = {
  async listCategories() {
    try {
      await ensureServiceTables();
      const rows: any = await prisma.$queryRawUnsafe(
        `SELECT id, name, slug, description FROM service_categories ORDER BY name ASC;`
      ).catch(() => []);

      if (Array.isArray(rows) && rows.length > 0) return rows;

      const defaultCategories = [
        { name: "Đồ uống", slug: "do-uong", description: "Các loại nước giải khát, nước suối, nước tăng lực, bù khoáng" },
        { name: "Đồ ăn", slug: "do-an", description: "Bánh mì, bánh ngọt, đồ ăn nhẹ, mì cốc" },
        { name: "Trái cây", slug: "trai-cay", description: "Trái cây tươi đóng hộp ướp lạnh" },
        { name: "Phụ kiện thể thao", slug: "dung-cu-the-thao", description: "Bóng, cầu lông, vớ, khăn tập, băng trán" },
        { name: "Cho thuê dụng cụ", slug: "cho-thue-dung-cu", description: "Cho thuê vợt Tennis, Cầu lông, Pickleball" },
        { name: "Combo thể thao", slug: "combo-the-thao", description: "Các gói Combo tiết kiệm cho cá nhân và nhóm/đội" },
        { name: "Dịch vụ khác", slug: "dich-vu-khac", description: "Các dịch vụ tiện ích bổ sung tại sân" }
      ];

      for (const cat of defaultCategories) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO service_categories (id, name, slug, description) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT (slug) DO NOTHING;`,
          cat.name, cat.slug, cat.description
        ).catch(() => {});
      }

      const fresh: any = await prisma.$queryRawUnsafe(
        `SELECT id, name, slug, description FROM service_categories ORDER BY name ASC;`
      ).catch(() => []);

      return Array.isArray(fresh) ? fresh : [];
    } catch (err) {
      console.error("[ServiceRepository] listCategories error:", err);
      return [];
    }
  },

  async createCategory(data: CreateServiceCategoryInput) {
    await ensureServiceTables();
    const slug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    return prisma.serviceCategory.create({
      data: {
        name: data.name,
        slug,
        description: data.description
      }
    });
  },

  async findServiceById(id: string) {
    await ensureServiceTables();
    return prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        inventory: true,
        court: { select: { id: true, name: true } }
      }
    });
  },

  async listPartnerServices(partnerId: string, categoryId?: string, search?: string, courtId?: string) {
    await ensureServiceTables();
    try {
      const validCategoryId = categoryId && categoryId.trim() !== "" ? categoryId.trim() : undefined;
      const validSearch = search && search.trim() !== "" ? search.trim() : undefined;
      const validCourtId = courtId && courtId.trim() !== "" ? courtId.trim() : undefined;

      const where: any = {
        ...(partnerId ? { partnerId } : {}),
        ...(validCourtId ? { courtId: validCourtId } : {}),
        ...(validCategoryId ? { categoryId: validCategoryId } : {}),
        ...(validSearch
          ? {
              OR: [
                { name: { contains: validSearch, mode: "insensitive" } },
                { description: { contains: validSearch, mode: "insensitive" } }
              ]
            }
          : {})
      };

      let services: any[] = await prisma.service.findMany({
        where,
        include: {
          category: true,
          inventory: true,
          court: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      if (!Array.isArray(services) || services.length === 0) {
        const rawSvcs: any = await prisma.$queryRawUnsafe(`
          SELECT 
            s.id,
            s.partner_id as "partnerId",
            s.category_id as "categoryId",
            s.name,
            s.description,
            s.type,
            s.sport_type as "sportType",
            s.price,
            s.cost_price as "costPrice",
            s.unit,
            s.image_url as "imageUrl",
            s.status,
            s.track_inventory as "trackInventory",
            c.name as "categoryName",
            s.court_id as "courtId",
            ct.name as "courtName",
            COALESCE(si.quantity, 0) as quantity,
            COALESCE(si.minimum_stock, 5) as "minimumStock"
          FROM services s
          LEFT JOIN service_categories c ON s.category_id = c.id
          LEFT JOIN courts ct ON ct.id = s.court_id
          LEFT JOIN service_inventories si ON s.id = si.service_id
          WHERE ($1::text IS NULL OR $1::text = '' OR s.partner_id = $1)
            AND ($2::text IS NULL OR $2::text = '' OR s.court_id = $2)
          ORDER BY s.created_at DESC;
        `, partnerId || "", validCourtId || "").catch(() => []);

        if (Array.isArray(rawSvcs) && rawSvcs.length > 0) {
          services = rawSvcs.map((r: any) => ({
            id: r.id,
            partnerId: r.partnerId,
            categoryId: r.categoryId,
            name: r.name,
            description: r.description,
            type: r.type,
            sportType: r.sportType,
            price: Number(r.price),
            costPrice: Number(r.costPrice || 0),
            unit: r.unit,
            imageUrl: r.imageUrl,
            status: r.status,
            trackInventory: r.trackInventory,
            courtId: r.courtId ?? null,
            court: r.courtId ? { id: r.courtId, name: r.courtName } : null,
            category: r.categoryName ? { id: r.categoryId, name: r.categoryName } : null,
            inventory: {
              quantity: Number(r.quantity || 0),
              minimumStock: Number(r.minimumStock || 5)
            }
          })) as any;
        }
      }

      // No name-based dedupe: a partner owns one services row (with its own stock) per court for
      // the same product name, so collapsing by name hid every court but one and made price edits
      // land on an arbitrary court. Callers that want one entry per name (the POS fallback list)
      // collapse it themselves.
      return services || [];
    } catch (err) {
      console.error("[ServiceRepository] listPartnerServices error:", err);
      return [];
    }
  },

  async listServicesForCourt(courtId: string, categoryId?: string) {
    try {
      await ensureServiceTables();

      const rows: any = await prisma.$queryRawUnsafe(`
        SELECT
          s.id,
          s.court_id as "courtId",
          s.partner_id as "partnerId",
          s.category_id as "categoryId",
          s.name,
          s.description,
          s.type,
          s.price,
          s.cost_price as "costPrice",
          s.unit,
          s.image_url as "imageUrl",
          s.status,
          s.track_inventory as "trackInventory",
          sc.name as "categoryName",
          sc.slug as "categorySlug",
          si.id as "inventoryId",
          COALESCE(si.quantity, 0) as "inventoryQuantity",
          si.reserved_quantity as "inventoryReservedQuantity",
          COALESCE(si.minimum_stock, 5) as "inventoryMinimumStock",
          si.unit as "inventoryUnit",
          si.last_purchase_price as "inventoryLastPurchasePrice",
          c.name as "courtName",
          cc.name as "courtCategoryName",
          cc.slug as "courtCategorySlug"
        FROM services s
        LEFT JOIN service_categories sc ON s.category_id = sc.id
        LEFT JOIN service_inventories si ON si.service_id = s.id
        LEFT JOIN courts c ON c.id = s.court_id
        LEFT JOIN court_categories cc ON cc.id = c.category_id
        -- Strictly this court's rows: after migrate_fix_orphan_service_owner.sql no service is
        -- court-less, and matching NULL court_id would show one partner's leftovers on every court.
        WHERE s.court_id = $1 AND (s.status = 'ACTIVE' OR s.status IS NULL)
        ORDER BY sc.name ASC, s.name ASC;
      `, courtId).catch(() => []);

      if (!Array.isArray(rows) || rows.length === 0) return [];

      const sport = detectSportFromText(
        `${rows[0].courtName || ""} ${rows[0].courtCategoryName || ""} ${rows[0].courtCategorySlug || ""}`
      );

      let filtered = rows.filter((r: any) => isServiceAllowedForSport(String(r.name || ""), sport));
      if (categoryId) {
        filtered = filtered.filter((r: any) => r.categoryId === categoryId);
      }

      const seenNames = new Set<string>();
      const uniqueRows: any[] = [];
      for (const r of filtered) {
        const key = r && r.name ? String(r.name).trim().toLowerCase() : "";
        if (key && !seenNames.has(key)) {
          seenNames.add(key);
          uniqueRows.push({
            id: r.id,
            courtId: r.courtId || courtId,
            partnerId: r.partnerId,
            categoryId: r.categoryId,
            name: r.name,
            description: r.description,
            type: r.type,
            price: Number(r.price),
            originalPrice: Number(r.price),
            costPrice: Number(r.costPrice || 0),
            unit: r.unit,
            imageUrl: r.imageUrl ?? null,
            status: r.status,
            trackInventory: r.trackInventory,
            categoryName: r.categoryName,
            categorySlug: r.categorySlug,
            category: r.categoryId ? { id: r.categoryId, name: r.categoryName, slug: r.categorySlug } : null,
            inventory: {
              id: r.inventoryId,
              serviceId: r.id,
              quantity: Number(r.inventoryQuantity ?? 0),
              reservedQuantity: Number(r.inventoryReservedQuantity ?? 0),
              minimumStock: Number(r.inventoryMinimumStock ?? 5),
              unit: r.unit,
              lastPurchasePrice: Number(r.inventoryLastPurchasePrice ?? 0)
            }
          });
        }
      }

      return uniqueRows;
    } catch (err) {
      console.error("[ServiceRepository] listServicesForCourt error:", err);
      return [];
    }
  },

  /** The partner a partner account or a receptionist works for, and the one court a receptionist runs. */
  async partnerScope(userId: string): Promise<{ partnerId: string; managedCourtId: string | null } | null> {
    const partner = await prisma.partnerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (partner) return { partnerId: partner.id, managedCourtId: null };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, partnerId: true, managedCourtId: true, managedCourt: { select: { partnerId: true } } }
    });
    if (user?.role !== "RECIPIENT") return null;
    const partnerId = user.partnerId ?? user.managedCourt?.partnerId;
    return partnerId ? { partnerId, managedCourtId: user.managedCourtId ?? null } : null;
  },

  courtPartnerId(courtId: string) {
    return prisma.court.findUnique({ where: { id: courtId }, select: { partnerId: true } }).then((court) => court?.partnerId ?? null);
  },

  partnerCourts(partnerId: string, courtIds: string[]) {
    return prisma.court.findMany({ where: { partnerId, id: { in: courtIds } }, select: { id: true, name: true } });
  },

  /** Rows of these courts already selling a product of this name (names compare trimmed, ignoring case). */
  sameNameAtCourts(courtIds: string[], name: string, exceptId?: string) {
    return prisma.$queryRaw<Array<{ id: string; courtName: string }>>`
      SELECT s.id, c.name AS "courtName"
      FROM services s
      JOIN courts c ON c.id = s.court_id
      WHERE s.court_id = ANY(${courtIds}::text[])
        AND lower(btrim(s.name)) = lower(btrim(${name}))
        AND s.id <> ${exceptId ?? ""}
    `;
  },

  /** Creates the product at each court: its own row, stock and opening stock entry. */
  async createService(partnerId: string, data: CreateServiceInput, actorId: string | null = null) {
    await ensureServiceTables();
    const cleanCategoryId = data.categoryId && data.categoryId.trim() !== "" && data.categoryId !== "ALL" ? data.categoryId.trim() : null;
    const cleanImageUrl = data.imageUrl && data.imageUrl.trim() !== "" ? data.imageUrl.trim() : null;
    const unit = data.unit ?? "cái";
    // Products are counted (from 0 unless told otherwise); rental gear only when the partner says how many they own.
    const counted = data.type === "RENTAL_SERVICE" ? data.initialStock != null : data.trackInventory !== false;
    const openingStock = counted ? data.initialStock ?? 0 : 0;

    return prisma.$transaction(async (tx) => {
      const created = [];
      for (const courtId of data.courtIds) {
        const service = await tx.service.create({
          data: {
            partnerId,
            courtId,
            categoryId: cleanCategoryId,
            name: data.name,
            description: data.description ?? null,
            type: data.type,
            sportType: data.sportType ?? "ALL",
            price: data.price,
            costPrice: data.costPrice ?? 0,
            unit,
            imageUrl: cleanImageUrl,
            trackInventory: counted
          }
        });

        if (counted) {
          await tx.serviceInventory.create({
            data: { serviceId: service.id, quantity: openingStock, minimumStock: data.minimumStock ?? 5, unit, lastPurchasePrice: data.costPrice ?? 0 }
          });
          if (openingStock > 0) {
            await tx.inventoryTransaction.create({
              data: {
                serviceId: service.id,
                type: "IMPORT",
                quantity: openingStock,
                unitCost: data.costPrice ?? 0,
                referenceType: "INITIAL_STOCK",
                note: "Tồn kho khởi tạo ban đầu"
              }
            });
          }
        }

        await recordPrice(tx, {
          serviceId: service.id,
          kind: "CREATED",
          oldPrice: null,
          newPrice: Number(service.price),
          oldCostPrice: null,
          newCostPrice: Number(service.costPrice),
          changedBy: actorId
        });

        // The court link the admin court page lists (and where a per-court price override would live).
        await tx.$executeRaw`
          INSERT INTO court_services (id, court_id, service_id, name, price, is_available, status, created_at, updated_at)
          VALUES (${`cs_${courtId}_${service.id.slice(0, 8)}`}, ${courtId}, ${service.id}, ${service.name}, ${service.price}, TRUE, 'ACTIVE', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `;

        created.push(
          await tx.service.findUniqueOrThrow({
            where: { id: service.id },
            include: { category: true, inventory: true, court: { select: { id: true, name: true } } }
          })
        );
      }
      return created;
    });
  },

  async updateService(id: string, data: UpdateServiceInput, actorId: string | null = null) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      // The prices before this edit, with the row locked so two edits at once each log what they really replaced.
      const before =
        data.price !== undefined || data.costPrice !== undefined
          ? (
              await tx.$queryRaw<Array<{ price: Prisma.Decimal; costPrice: Prisma.Decimal | null }>>`
                SELECT price, cost_price AS "costPrice" FROM services WHERE id = ${id} FOR UPDATE
              `
            )[0]
          : undefined;

      const updated = await tx.service.update({
        where: { id },
        data: {
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.sportType !== undefined ? { sportType: data.sportType } : {}),
          ...(data.price !== undefined ? { price: data.price } : {}),
          ...(data.costPrice !== undefined ? { costPrice: data.costPrice } : {}),
          ...(data.unit !== undefined ? { unit: data.unit } : {}),
          ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.trackInventory !== undefined ? { trackInventory: data.trackInventory } : {}),
          ...(data.courtId !== undefined ? { courtId: data.courtId } : {})
        }
      });

      if (before && pricesChanged(before, updated)) {
        await recordPrice(tx, {
          serviceId: id,
          kind: "CHANGED",
          oldPrice: Number(before.price),
          newPrice: Number(updated.price),
          oldCostPrice: Number(before.costPrice ?? 0),
          newCostPrice: Number(updated.costPrice),
          changedBy: actorId
        });
      }

      if (data.courtId !== undefined) {
        await tx.$executeRaw`
          INSERT INTO court_services (id, court_id, service_id, name, price, is_available, status, created_at, updated_at)
          VALUES (${`cs_${data.courtId}_${id.slice(0, 8)}`}, ${data.courtId}, ${id}, ${updated.name}, ${updated.price}, TRUE, 'ACTIVE', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `;
      }

      if (data.minimumStock !== undefined) {
        await tx.serviceInventory.upsert({
          where: { serviceId: id },
          update: { minimumStock: data.minimumStock },
          create: {
            serviceId: id,
            minimumStock: data.minimumStock,
            quantity: 0,
            unit: data.unit ?? "cái"
          }
        });
      }

      return tx.service.findUnique({
        where: { id },
        include: { category: true, inventory: true, court: { select: { id: true, name: true } } }
      });
    });
  },

  /** A service's price history, newest first, with the name of whoever set each price. */
  async priceHistory(serviceId: string) {
    await ensureServiceTables();
    return prisma.$queryRaw<PriceHistoryRow[]>`
      SELECT h.id, h.kind,
             h.old_price AS "oldPrice", h.new_price AS "newPrice",
             h.old_cost_price AS "oldCostPrice", h.new_cost_price AS "newCostPrice",
             h.changed_at AS "changedAt", h.changed_by AS "changedById", u.full_name AS "changedByName"
      FROM service_price_history h
      LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.service_id = ${serviceId}
      ORDER BY h.changed_at DESC, h.id DESC
      LIMIT 200
    `;
  },

  /** The latest price history line of each service (what kind, when), for the catalog cards. */
  async lastPriceChanges(serviceIds: string[]) {
    if (!serviceIds.length) return [];
    await ensureServiceTables();
    return prisma.$queryRaw<Array<{ serviceId: string; kind: PriceHistoryKind; changedAt: Date }>>`
      SELECT DISTINCT ON (service_id) service_id AS "serviceId", kind, changed_at AS "changedAt"
      FROM service_price_history
      WHERE service_id = ANY(${serviceIds}::text[])
      ORDER BY service_id, changed_at DESC, id DESC
    `;
  },

  /**
   * Deletes a product nobody has used yet (its stock row, opening stock entry and court link go with it). One that was
   * sold, rented, ordered from a supplier or moved in stock keeps its history and only stops being sold (INACTIVE).
   */
  async deleteOrRetireService(id: string) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      if (await serviceUsed(tx, id)) {
        await tx.service.update({ where: { id }, data: { status: "INACTIVE" } });
        return { deleted: false, deactivated: true };
      }
      await tx.service.delete({ where: { id } });
      return { deleted: true, deactivated: false };
    });
  },

  /**
   * A partner owns one row per court for the same product name, so an image uploaded once is
   * meant for all of them — otherwise the same drink would need re-uploading for every court.
   * Price, stock and status stay per court; only the picture is shared.
   */
  async applyImageToPartnerServices(partnerId: string, name: string, imageUrl: string | null) {
    await ensureServiceTables();
    return prisma.service.updateMany({
      where: { partnerId, name },
      data: { imageUrl }
    });
  }
};
