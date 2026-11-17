typedef Json = Map<String, dynamic>;

DateTime? _date(Object? v) => v == null ? null : DateTime.parse(v as String);
int _int(Object? v) => v == null ? 0 : (v as num).toInt();
double _double(Object? v) => v == null ? 0 : (v as num).toDouble();
List<T> _list<T>(Object? v, T Function(Json) f) => ((v as List?) ?? const []).map((e) => f(e as Json)).toList();
List<String> _strings(Object? v) => ((v as List?) ?? const []).map((e) => e.toString()).toList();

const staffRoles = {'HOST', 'CO_HOST', 'LEAD', 'VENUE', 'PLATFORM'};
const senderRoles = {'HOST', 'CO_HOST', 'LEAD'};
const adminRoles = {'HOST', 'CO_HOST', 'PLATFORM'};

class User {
  final String id;
  final String phone;
  final String? name;
  final String? email;
  final bool isPlatformAdmin;

  const User({required this.id, required this.phone, this.name, this.email, this.isPlatformAdmin = false});

  factory User.fromJson(Json j) => User(
        id: j['id'] as String,
        phone: j['phone'] as String,
        name: j['name'] as String?,
        email: j['email'] as String?,
        isPlatformAdmin: j['isPlatformAdmin'] == true,
      );
}

class AccessibleWedding {
  final String slug;
  final String brideName;
  final String groomName;
  final DateTime? weddingDate;
  final String? coverPhotoUrl;
  final String role;

  const AccessibleWedding({required this.slug, required this.brideName, required this.groomName, this.weddingDate, this.coverPhotoUrl, required this.role});

  factory AccessibleWedding.fromJson(Json j) => AccessibleWedding(
        slug: j['slug'] as String,
        brideName: j['brideName'] as String,
        groomName: j['groomName'] as String,
        weddingDate: _date(j['weddingDate']),
        coverPhotoUrl: j['coverPhotoUrl'] as String?,
        role: j['role'] as String,
      );

  String get couple => '$brideName & $groomName';
}

class Session {
  final User user;
  final List<AccessibleWedding> weddings;

  const Session(this.user, this.weddings);

  factory Session.fromJson(Json j) => Session(User.fromJson(j['user'] as Json), _list(j['weddings'], AccessibleWedding.fromJson));
}

class OtpRequest {
  final String phone;
  final String maskedPhone;
  final String channel;
  final int expiresInSec;
  final int resendAfterSec;
  final String? devOtp;

  const OtpRequest({required this.phone, required this.maskedPhone, required this.channel, required this.expiresInSec, required this.resendAfterSec, this.devOtp});

  factory OtpRequest.fromJson(Json j) => OtpRequest(
        phone: j['phone'] as String,
        maskedPhone: j['maskedPhone'] as String,
        channel: j['channel'] as String,
        expiresInSec: _int(j['expiresInSec']),
        resendAfterSec: _int(j['resendAfterSec']),
        devOtp: j['devOtp'] as String?,
      );
}

class Wedding {
  final String id;
  final String slug;
  final String brideName;
  final String groomName;
  final String? welcomeNote;
  final String? videoInviteUrl;
  final String? coverPhotoUrl;
  final String? city;
  final DateTime? weddingDate;
  final String? propertyName;
  final String? propertyLocation;
  final String? reraRegId;
  final String? escrowBankName;
  final bool taxExemptionEnabled;

  const Wedding({
    required this.id,
    required this.slug,
    required this.brideName,
    required this.groomName,
    this.welcomeNote,
    this.videoInviteUrl,
    this.coverPhotoUrl,
    this.city,
    this.weddingDate,
    this.propertyName,
    this.propertyLocation,
    this.reraRegId,
    this.escrowBankName,
    this.taxExemptionEnabled = true,
  });

  factory Wedding.fromJson(Json j) => Wedding(
        id: j['id'] as String,
        slug: j['slug'] as String,
        brideName: j['brideName'] as String,
        groomName: j['groomName'] as String,
        welcomeNote: j['welcomeNote'] as String?,
        videoInviteUrl: j['videoInviteUrl'] as String?,
        coverPhotoUrl: j['coverPhotoUrl'] as String?,
        city: j['city'] as String?,
        weddingDate: _date(j['weddingDate']),
        propertyName: j['propertyName'] as String?,
        propertyLocation: j['propertyLocation'] as String?,
        reraRegId: j['reraRegId'] as String?,
        escrowBankName: j['escrowBankName'] as String?,
        taxExemptionEnabled: j['taxExemptionEnabled'] != false,
      );

  String get couple => '$brideName & $groomName';
  String get firstNames => '${brideName.split(' ').first} & ${groomName.split(' ').first}';
}

class Ceremony {
  final String id;
  final String title;
  final String? description;
  final DateTime startsAt;
  final DateTime? endsAt;
  final String venueName;
  final String? venueAddress;
  final String? venueMapsUrl;
  final String? streamUrl;
  final String? dressCode;

  const Ceremony({
    required this.id,
    required this.title,
    this.description,
    required this.startsAt,
    this.endsAt,
    required this.venueName,
    this.venueAddress,
    this.venueMapsUrl,
    this.streamUrl,
    this.dressCode,
  });

  factory Ceremony.fromJson(Json j) => Ceremony(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        startsAt: DateTime.parse(j['startsAt'] as String),
        endsAt: _date(j['endsAt']),
        venueName: j['venueName'] as String,
        venueAddress: j['venueAddress'] as String?,
        venueMapsUrl: j['venueMapsUrl'] as String?,
        streamUrl: j['streamUrl'] as String?,
        dressCode: j['dressCode'] as String?,
      );
}

class Invitation {
  final String id;
  final String guestName;
  final String cohort;
  final int maxAttendees;
  final bool enableRegistry;
  final String? refLead;

  const Invitation({required this.id, required this.guestName, required this.cohort, required this.maxAttendees, required this.enableRegistry, this.refLead});

  factory Invitation.fromJson(Json j) => Invitation(
        id: j['id'] as String,
        guestName: j['guestName'] as String,
        cohort: j['cohort'] as String,
        maxAttendees: _int(j['maxAttendees']),
        enableRegistry: j['enableRegistry'] != false,
        refLead: j['refLead'] as String?,
      );
}

class Rsvp {
  final String status;
  final int adults;
  final int children;
  final int infants;
  final List<String> attendingCeremonyIds;
  final List<String> dietary;
  final String? allergies;
  final String? arrivalMode;
  final String? arrivalDetails;
  final bool needsAccommodation;
  final DateTime? checkInDate;
  final DateTime? checkOutDate;
  final bool needsShuttle;
  final String? note;

  const Rsvp({
    required this.status,
    required this.adults,
    required this.children,
    required this.infants,
    required this.attendingCeremonyIds,
    required this.dietary,
    this.allergies,
    this.arrivalMode,
    this.arrivalDetails,
    this.needsAccommodation = false,
    this.checkInDate,
    this.checkOutDate,
    this.needsShuttle = false,
    this.note,
  });

  factory Rsvp.fromJson(Json j) => Rsvp(
        status: j['status'] as String,
        adults: _int(j['adults']),
        children: _int(j['children']),
        infants: _int(j['infants']),
        attendingCeremonyIds: _strings(j['attendingCeremonyIds']),
        dietary: _strings(j['dietary']),
        allergies: j['allergies'] as String?,
        arrivalMode: j['arrivalMode'] as String?,
        arrivalDetails: j['arrivalDetails'] as String?,
        needsAccommodation: j['needsAccommodation'] == true,
        checkInDate: _date(j['checkInDate']),
        checkOutDate: _date(j['checkOutDate']),
        needsShuttle: j['needsShuttle'] == true,
        note: j['note'] as String?,
      );
}

class RegistrySummary {
  final int totalSft;
  final int fundedSft;
  final int heldSft;
  final double progress;
  final int ratePerSftPaise;
  final int raisedPaise;
  final int targetPaise;
  final List<int> presetTiers;
  final int holdTtlSec;

  const RegistrySummary({
    required this.totalSft,
    required this.fundedSft,
    required this.heldSft,
    required this.progress,
    required this.ratePerSftPaise,
    required this.raisedPaise,
    required this.targetPaise,
    required this.presetTiers,
    required this.holdTtlSec,
  });

  factory RegistrySummary.fromJson(Json j) => RegistrySummary(
        totalSft: _int(j['totalSft']),
        fundedSft: _int(j['fundedSft']),
        heldSft: _int(j['heldSft']),
        progress: _double(j['progress']),
        ratePerSftPaise: _int(j['ratePerSftPaise']),
        raisedPaise: _int(j['raisedPaise']),
        targetPaise: _int(j['targetPaise']),
        presetTiers: ((j['presetTiers'] as List?) ?? const []).map(_int).toList(),
        holdTtlSec: _int(j['holdTtlSec']),
      );
}

class Microsite {
  final Wedding wedding;
  final String role;
  final Invitation? invitation;
  final List<Ceremony> ceremonies;
  final Rsvp? rsvp;
  final RegistrySummary registry;

  const Microsite({required this.wedding, required this.role, this.invitation, required this.ceremonies, this.rsvp, required this.registry});

  factory Microsite.fromJson(Json j) => Microsite(
        wedding: Wedding.fromJson(j['wedding'] as Json),
        role: j['role'] as String,
        invitation: j['invitation'] == null ? null : Invitation.fromJson(j['invitation'] as Json),
        ceremonies: _list(j['ceremonies'], Ceremony.fromJson),
        rsvp: j['rsvp'] == null ? null : Rsvp.fromJson(j['rsvp'] as Json),
        registry: RegistrySummary.fromJson(j['registry'] as Json),
      );

  bool get isStaff => staffRoles.contains(role);
  bool get registryEnabled => role != 'GUEST' || (invitation?.enableRegistry ?? true);
}

class RoomState {
  final String key;
  final String name;
  final String? description;
  final String? icon;
  final int sft;
  final int fundedSft;
  final int heldSft;
  final int openSft;
  final int startIndex;
  final String cells;
  final Map<String, String> donors;

  const RoomState({
    required this.key,
    required this.name,
    this.description,
    this.icon,
    required this.sft,
    required this.fundedSft,
    required this.heldSft,
    required this.openSft,
    required this.startIndex,
    this.cells = '',
    this.donors = const {},
  });

  factory RoomState.fromJson(Json j) => RoomState(
        key: j['key'] as String,
        name: j['name'] as String,
        description: j['description'] as String?,
        icon: j['icon'] as String?,
        sft: _int(j['sft']),
        fundedSft: _int(j['fundedSft']),
        heldSft: _int(j['heldSft']),
        openSft: _int(j['openSft']),
        startIndex: _int(j['startIndex']),
        cells: (j['cells'] as String?) ?? '',
        donors: ((j['donors'] as Map?) ?? const {}).map((k, v) => MapEntry(k.toString(), v.toString())),
      );
}

class RegistryState {
  final RegistrySummary summary;
  final int openSft;
  final List<RoomState> rooms;

  const RegistryState(this.summary, this.openSft, this.rooms);

  factory RegistryState.fromJson(Json j) => RegistryState(RegistrySummary.fromJson(j), _int(j['openSft']), _list(j['rooms'], RoomState.fromJson));
}

class Links {
  final String? checkoutUrl;
  final String? receiptUrl;
  final String? thankYouUrl;

  const Links({this.checkoutUrl, this.receiptUrl, this.thankYouUrl});

  factory Links.fromJson(Json? j) => Links(
        checkoutUrl: j?['checkoutUrl'] as String?,
        receiptUrl: j?['receiptUrl'] as String?,
        thankYouUrl: j?['thankYouUrl'] as String?,
      );
}

class Contribution {
  final String id;
  final String status;
  final int units;
  final int amountPaise;
  final String roomName;
  final String donorName;
  final String? receiptNumber;
  final DateTime? paidAt;
  final DateTime createdAt;
  final Links links;

  const Contribution({
    required this.id,
    required this.status,
    required this.units,
    required this.amountPaise,
    required this.roomName,
    required this.donorName,
    this.receiptNumber,
    this.paidAt,
    required this.createdAt,
    required this.links,
  });

  factory Contribution.fromJson(Json j, [Json? links]) => Contribution(
        id: j['id'] as String,
        status: j['status'] as String,
        units: _int(j['units']),
        amountPaise: _int(j['amountPaise']),
        roomName: (j['room'] as Json)['name'] as String,
        donorName: j['donorName'] as String,
        receiptNumber: j['receiptNumber'] as String?,
        paidAt: _date(j['paidAt']),
        createdAt: DateTime.parse(j['createdAt'] as String),
        links: Links.fromJson(links ?? j['links'] as Json?),
      );
}

class WallEntry {
  final String id;
  final String donorName;
  final String initials;
  final String? relationship;
  final int units;
  final String roomName;
  final String? blessing;

  const WallEntry({required this.id, required this.donorName, required this.initials, this.relationship, required this.units, required this.roomName, this.blessing});

  factory WallEntry.fromJson(Json j) => WallEntry(
        id: j['id'] as String,
        donorName: j['donorName'] as String,
        initials: (j['initials'] as String?) ?? '',
        relationship: j['relationship'] as String?,
        units: _int(j['units']),
        roomName: (j['room'] as Json)['name'] as String,
        blessing: j['blessing'] as String?,
      );
}

class Blessing {
  final String id;
  final String authorName;
  final String? message;
  final String? photoUrl;
  final String? tableNumber;
  final String status;
  final DateTime createdAt;

  const Blessing({required this.id, required this.authorName, this.message, this.photoUrl, this.tableNumber, required this.status, required this.createdAt});

  factory Blessing.fromJson(Json j) => Blessing(
        id: j['id'] as String,
        authorName: j['authorName'] as String,
        message: j['message'] as String?,
        photoUrl: j['photoUrl'] as String?,
        tableNumber: j['tableNumber'] as String?,
        status: j['status'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}

class InvitedCeremony {
  final String id;
  final String title;
  final DateTime startsAt;
  final String venueName;

  const InvitedCeremony(this.id, this.title, this.startsAt, this.venueName);

  factory InvitedCeremony.fromJson(Json j) => InvitedCeremony(j['id'] as String, j['title'] as String, DateTime.parse(j['startsAt'] as String), j['venueName'] as String);
}

class MyRsvp {
  final String guestName;
  final String? email;
  final int maxAttendees;
  final List<InvitedCeremony> invitedCeremonies;
  final Rsvp? rsvp;

  const MyRsvp({required this.guestName, this.email, required this.maxAttendees, required this.invitedCeremonies, this.rsvp});

  factory MyRsvp.fromJson(Json j) {
    final inv = j['invitation'] as Json;
    return MyRsvp(
      guestName: inv['guestName'] as String,
      email: inv['email'] as String?,
      maxAttendees: _int(inv['maxAttendees']),
      invitedCeremonies: _list(j['invitedCeremonies'], InvitedCeremony.fromJson),
      rsvp: j['rsvp'] == null ? null : Rsvp.fromJson(j['rsvp'] as Json),
    );
  }
}

class StagePayload {
  final Wedding wedding;
  final String displayMode;
  final RegistryState registry;
  final List<WallEntry> donors;
  final List<Blessing> blessings;
  final String giftUrl;

  const StagePayload({required this.wedding, required this.displayMode, required this.registry, required this.donors, required this.blessings, required this.giftUrl});

  factory StagePayload.fromJson(Json j) {
    final w = j['wedding'] as Json;
    return StagePayload(
      wedding: Wedding.fromJson(w),
      displayMode: w['displayMode'] as String,
      registry: RegistryState.fromJson(j['registry'] as Json),
      donors: _list(j['donors'], WallEntry.fromJson),
      blessings: _list(j['blessings'], Blessing.fromJson),
      giftUrl: j['giftUrl'] as String,
    );
  }

  StagePayload copyWith({RegistryState? registry, List<WallEntry>? donors, List<Blessing>? blessings}) => StagePayload(
        wedding: wedding,
        displayMode: displayMode,
        registry: registry ?? this.registry,
        donors: donors ?? this.donors,
        blessings: blessings ?? this.blessings,
        giftUrl: giftUrl,
      );
}

class Dashboard {
  final int guests;
  final int responded;
  final int attending;
  final int headcount;
  final RegistrySummary registry;
  final int contributors;
  final int creditedPaise;
  final int availablePaise;
  final int sent;
  final int failed;

  const Dashboard({
    required this.guests,
    required this.responded,
    required this.attending,
    required this.headcount,
    required this.registry,
    required this.contributors,
    required this.creditedPaise,
    required this.availablePaise,
    required this.sent,
    required this.failed,
  });

  factory Dashboard.fromJson(Json j) {
    final rsvp = j['rsvp'] as Json;
    final hc = rsvp['headcount'] as Json;
    final dispatch = j['dispatch'] as Json;
    return Dashboard(
      guests: _int((j['guests'] as Json)['total']),
      responded: _int(rsvp['responded']),
      attending: _int((rsvp['byStatus'] as Json)['ATTENDING']),
      headcount: _int(hc['adults']) + _int(hc['children']),
      registry: RegistrySummary.fromJson(j['registry'] as Json),
      contributors: _int((j['gifts'] as Json)['contributors']),
      creditedPaise: _int((j['escrow'] as Json)['creditedPaise']),
      availablePaise: _int((j['escrow'] as Json)['availablePaise']),
      sent: _int(dispatch['SENT']),
      failed: _int(dispatch['FAILED']),
    );
  }
}

class DispatchSummary {
  final String id;
  final DateTime createdAt;
  final List<String> cohorts;
  final int total;
  final int queued;
  final int sent;
  final int failed;
  final int skipped;

  const DispatchSummary({required this.id, required this.createdAt, required this.cohorts, required this.total, required this.queued, required this.sent, required this.failed, required this.skipped});

  factory DispatchSummary.fromJson(Json j) => DispatchSummary(
        id: j['id'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
        cohorts: _strings(j['cohorts']),
        total: _int(j['total']),
        queued: _int(j['queued']),
        sent: _int(j['sent']),
        failed: _int(j['failed']),
        skipped: _int(j['skipped']),
      );
}

const cohortLabels = {
  'CLOSE_FAMILY': 'Close Family',
  'FAMILY': 'Family',
  'FRIENDS': 'Friends',
  'COLLEAGUES': 'Colleagues',
  'VIP': 'VIP',
  'OTHER': 'Other',
};

const dietaryLabels = {
  'VEG': 'Vegetarian',
  'NON_VEG': 'Non-vegetarian',
  'JAIN': 'Jain',
  'VEGAN': 'Vegan',
  'SATVIK': 'Satvik',
  'GLUTEN_FREE': 'Gluten-free',
};
