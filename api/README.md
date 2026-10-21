# ErpApi — React(Lovable) 프론트용 C# 백엔드 설계

프론트의 `services/*.ts`와 `types/*.ts`에 정의된 계약을 그대로 구현한 ASP.NET Core Web API(.NET 10, EF Core, SQL Server) 뼈대입니다.

## 폴더 구성

```
ErpApi/
├─ Program.cs                       DI, JWT, CORS, JSON(enum 문자열), 에러 응답 형식
├─ appsettings.json                 접속 문자열, JWT, CORS 허용 Origin
├─ Common/
│  ├─ ApiResponse.cs                ApiResponse<T>, PaginatedResponse<T>, 페이징 확장 메서드
│  ├─ Errors.cs                     업무 예외 + 전역 예외 처리 (→ ApiResponse 형식)
│  └─ CurrentUser.cs                역할(Role) 정의, JWT 클레임 → 로그인 사용자
├─ Domain/Entities.cs               EF Core 엔티티, enum
├─ Data/AppDbContext.cs, DbSeeder.cs
├─ Dtos/                            프론트 types/*.ts 와 1:1 대응
├─ Services/
│  ├─ AuthService.cs, TokenService.cs   로그인·리프레시 토큰 로테이션·로그아웃
│  ├─ SlipService.cs                    전표 업무 로직
│  ├─ SlipWorkflow.cs                   상태 전이 규칙 (여기만 고치면 흐름이 바뀜)
│  └─ SlipNumberGenerator.cs            전표 번호 채번
└─ Controllers/
   ├─ MasterControllers.cs          마스터 공통 CRUD 베이스 + 사원/품목/창고/거래처
   └─ AuthAndSlipControllers.cs     인증, 전표
```

## 실행 방법

1. `appsettings.json`의 `ConnectionStrings:Default`를 환경에 맞게 수정하고, `Jwt:SigningKey`를 32바이트 이상의 임의 문자열로 바꿉니다.
2. 마이그레이션을 생성합니다.
   ```bash
   dotnet tool install --global dotnet-ef
   dotnet ef migrations add Initial
   ```
3. `dotnet run` → `http://localhost:5000` 에서 실행됩니다. Development 환경에서는 시작 시 마이그레이션 적용과 테스트 데이터 등록이 자동으로 이뤄집니다.
   - 테스트 계정: `admin / Admin123!`(관리자), `manager1 / Manager123!`(승인자), `user1 / User123!`(일반)
   - 테스트 마스터: 창고 `WH01`, 품목 `ITM-0001`, 거래처 `PT001`
4. 프론트 `.env`
   ```
   VITE_API_BASE_URL=http://localhost:5000/api/
   VITE_USE_MOCK_DATA=false
   ```

.NET 8을 사용하는 경우 csproj의 `TargetFramework`를 `net8.0`, 패키지 버전을 `8.0.x`로 바꾸면 코드는 그대로 동작합니다. (단, .NET 8 지원은 2026년 11월에 종료됩니다.)

## 엔드포인트 목록

모든 경로는 `/api` 접두어를 가지며, `auth/login`·`auth/refresh` 외에는 Bearer 토큰이 필요합니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/login` | 로그인 → `LoginResponse` |
| POST | `/auth/refresh` | 리프레시 토큰 로테이션 |
| POST | `/auth/logout` | 해당 사용자의 리프레시 토큰 전부 폐기 |
| GET / POST | `/employees` | 목록(페이징·검색) / 등록 |
| GET / PUT / DELETE | `/employees/{id}` | 상세 / 수정 / 삭제 |
| GET / POST | `/items` | 목록 / 등록 |
| GET / PUT / DELETE | `/items/{id}` | 상세 / 수정 / 삭제 |
| GET | `/items/code/{code}` | 품목 코드로 조회 |
| GET | `/items/{itemCode}/stock` | 창고별 재고 |
| GET / POST | `/warehouses`, GET/PUT/DELETE `/warehouses/{id}` | 창고 CRUD |
| GET / POST | `/partners`, GET/PUT/DELETE `/partners/{id}` | 거래처 CRUD (`?type=` 필터 지원) |
| GET | `/partners/lookup?type=` | **신규** 드롭다운용 (페이징 없음, 유효 거래처만) |
| GET / POST | `/slips` | 전표 목록 / 작성 |
| GET / PUT / DELETE | `/slips/{slipNo}` | 상세 / 수정 / 삭제 |
| PATCH | `/slips/{slipNo}/status` | 상태 변경 (신청·승인·반려·후속 처리) |

## 응답 규약

성공·실패 모두 `{ success, data, message, errors, timestamp }` 형태입니다. 프론트 `api-client`는 HTTP 상태보다 `success`를 먼저 확인하기 때문에, 아래 경우까지 전부 이 형식으로 맞췄습니다.

- 입력 검증 실패(400): `errors`에 `"필드명: 메시지"` 문자열 배열
- 업무 예외(400/403/404/409): `BusinessException` 계열을 던지면 `message`에 그대로 담김
- 인증 실패(401) / 권한 없음(403): JwtBearer 이벤트에서 처리
- 동시 수정 충돌(409): 전표 `RowVersion` 불일치
- 서버 오류(500): Development 환경에서만 `errors`에 스택 트레이스 포함

## 프론트 코드에서 수정이 필요한 부분

**1. `api-client.ts`의 `buildURL` (필수)**
현재는 `new URL("/employees", "http://localhost:5000/api")`가 `http://localhost:5000/employees`로 해석되어 `/api`가 사라집니다.

```ts
private buildURL(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const base = this.baseURL.replace(/\/+$/, "");
  const path = endpoint.replace(/^\/+/, "");
  const url = new URL(`${base}/${path}`);
  // ... 이하 동일
}
```

**2. `partnerService.getByType` (필수)**
`/partners`는 항상 `PaginatedResponse`를 반환하므로, 배열이 필요한 이 함수는 `/partners/lookup`을 호출하도록 바꿉니다.

```ts
async getByType(type: "CUSTOMER" | "SUPPLIER" | "BOTH"): Promise<Partner[]> {
  return apiClient.get<Partner[]>("/partners/lookup", { params: { type } });
},
```

**3. 401 시 자동 토큰 갱신 (권장)**
액세스 토큰 유효기간은 30분입니다. 현재 `api-client`에는 401 → `/auth/refresh` → 재요청 로직이 없어서, 30분 후에는 재로그인이 필요합니다.

**4. 타입 차이 (참고)**
`ApiError.details`는 `Record<string, string[]>`인데 `ApiResponse.errors`는 `string[]`입니다. 백엔드는 `ApiResponse.errors`(문자열 배열) 기준으로 맞췄습니다.

## 설계상 결정 사항 (가정 포함)

**재고**
재고의 기준은 `ItemStock`(품목×창고) 테이블입니다. 응답의 `item.stockQty`와 `warehouse.currentStock`은 이 테이블의 합계입니다. `ItemRequest.stockQty`는 **신규 등록 시에만** 기본 창고의 초기 재고로 반영되고, 수정 시에는 무시됩니다. `WarehouseRequest.currentStock`도 무시됩니다. 재고 변동은 앞으로 전표(입고·출고) 처리와 연결하는 것을 전제로 했습니다.

**전표 작성**
- `requester` / `department`는 요청 값을 무시하고 JWT의 로그인 사용자 정보로 설정합니다(위장 방지).
- 명세의 품목명·규격·단위는 품목 마스터 값으로 덮어쓰고, 단가는 요청 값을 사용합니다.
- 금액(`amount`, `totalAmount`)은 서버에서 계산하며, 엔 단위 반올림입니다.
- 전표 번호 형식은 `PROD-20261021-0001`입니다.
- `partner`는 **거래처 코드**로 취급하여 존재 여부를 검증합니다.

**전표 수정 (PUT)**
편집 가능한 항목을 통째로 교체합니다. `deliveryDate` 등을 생략하면 값이 지워지고, `items`를 생략(null)했을 때만 명세를 유지합니다.

**상태 전이 (`SlipWorkflow.cs`)**

| 현재 | 이동 가능 | 비고 |
|---|---|---|
| S00 작성 | S01 | 신청 |
| S01 신청 | A00, A01, A02, S00 | 승인대기 / 승인 / 반려 / 취하 |
| A00 승인대기 | A01, A02 | |
| A02 반려 | S01, S00 | 재신청 / 작성중으로 |
| A01 승인 | PROD: P00 → P01 → … → P04 → I00 | 구매 → 검수 |
| A01 승인 | SHIP: T01 → T02 → T03 | 출고 |
| A01 승인 | BOM: 종료 | |

**권한**
- 승인·반려·승인대기(A00/A01/A02): `admin`, `manager` 역할만 가능, 본인이 작성한 전표는 불가, 반려 시 사유(note) 필수
- 신청·취하(S00/S01): 작성자 또는 관리자
- 수정·삭제: S00·A02 상태에서 작성자 또는 관리자
- 구매·출고 등 후속 처리: 로그인 사용자 누구나 (`handler`에 기록)

**마스터 삭제**
재고가 남은 품목·창고, 전표에서 사용 중인 품목·거래처, 기본 창고로 지정된 창고는 삭제할 수 없고 409를 반환합니다. 대신 `isActive=false`로 비활성화하는 운용을 권장합니다.

## 확인이 필요한 사항

아래는 프론트 코드만으로는 알 수 없어서 추정한 부분입니다. 실제와 다르면 표시한 파일만 고치면 됩니다.

- 각 상태 코드(A00, P00~P04, T01~T03 등)의 실제 의미와 흐름 → `SlipWorkflow.cs`
- 실제 사용하는 역할명 → `Common/CurrentUser.cs`의 `Roles`
- 전표의 `partner`가 코드인지 이름인지 → `SlipService.EnsurePartnerAsync`
- 전표 종류 표시명(`typeName`) → `SlipWorkflow.TypeName`
- 전표 번호 형식, 금액 반올림 규칙 → `SlipNumberGenerator.cs`, `SlipService.BuildLinesAsync`

## 향후 개선 포인트

- 전표 명세·품목 기본 창고·전표 거래처가 **코드 문자열**로 마스터를 참조하고 있어, 마스터 코드를 바꾸면 참조가 끊어집니다. 코드 변경을 막거나, 장기적으로는 ID 기반 외래 키로 바꾸는 것을 권장합니다.
- PostgreSQL로 바꿀 경우 `UseNpgsql`로 변경하고, `Slip.RowVersion`은 `xmin` 기반 동시성 토큰으로 바꿔야 합니다.
- 검증 메시지(DataAnnotations 기본 메시지)는 영어이므로, 필요하면 `ErrorMessage`를 일본어로 지정하세요.
