// Rule data for the NetWise troubleshooting engine.
//
// `symptoms` defines every observation the user can report, with a fixed set
// of allowed values. `faults` describes each supported fault: the conditions
// that identify it, the checks that confirm it, and how to fix and verify it.
//
// Conventions:
// - device "pc" commands are typed in Packet Tracer: PC > Desktop > Command Prompt.
// - device "router" / "switch" commands are Cisco IOS commands typed in
//   privileged EXEC mode (prompt ends in "#"; type `enable` first if it ends in ">").
// - fix.commands are listed in the order they are typed, starting from
//   privileged EXEC mode.
// - <angle brackets> are placeholders, filled in from the NetWise plan.

export const NOT_TESTED = 'not_tested';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const pingValues = {
  success: 'Replies received',
  fail: 'Failed (timed out or unreachable)',
  [NOT_TESTED]: 'Not tested',
};

const yesNoValues = {
  yes: 'Yes',
  no: 'No',
  [NOT_TESTED]: 'Not checked',
};

export const symptoms = deepFreeze({
  pcIpStatus: {
    label: 'PC IP address and subnet mask',
    howToTest:
      'On the PC run ipconfig. Compare the IPv4 address and subnet mask with the department in the NetWise plan.',
    values: {
      in_planned_subnet: 'Inside the planned subnet, with the planned mask',
      wrong_subnet_or_mask: 'Outside the planned subnet, or wrong subnet mask',
      apipa_169_254: 'Starts with 169.254 (no DHCP reply)',
      [NOT_TESTED]: 'Not checked',
    },
  },
  pcGatewayMatchesPlan: {
    label: 'PC default gateway matches the plan',
    howToTest: 'On the PC run ipconfig. Compare "Default Gateway" with the gateway in the NetWise plan.',
    values: {
      yes: 'Matches the plan',
      no: 'Different from the plan, or empty',
      [NOT_TESTED]: 'Not checked',
    },
  },
  linkLights: {
    label: 'Link lights between the PC, its switch and the router',
    howToTest:
      'In the Packet Tracer workspace, look at the dots at both ends of each cable on the path. ' +
      'Amber for up to 30 seconds after connecting is normal; wait and look again.',
    values: {
      all_green: 'All green',
      some_red: 'At least one red',
      [NOT_TESTED]: 'Not checked',
    },
  },
  gatewayPing: {
    label: 'Ping from the PC to its default gateway',
    howToTest:
      'On the PC run ping <default gateway IP from the plan>. If only the first reply times out, count it as success.',
    values: pingValues,
  },
  sameVlanPing: {
    label: 'Ping from the PC to another PC in the same department (same VLAN)',
    howToTest: 'On the PC run ping <IP of another PC in the same department>.',
    values: pingValues,
  },
  otherVlanPing: {
    label: 'Ping from the PC to a PC in another department on the same router',
    howToTest: 'On the PC run ping <IP of a PC in a different department>.',
    values: pingValues,
  },
  otherVlansReachGateway: {
    label: 'PCs in other departments can ping their own default gateways',
    howToTest: 'From a PC in another department, run ping <that department\'s default gateway IP>.',
    values: yesNoValues,
  },
  remoteNetworkPing: {
    label: 'Ping from the PC to a host in a network behind another router',
    howToTest: 'On the PC run ping <IP of a host on a remote network>.',
    values: pingValues,
  },
  remotePingMessage: {
    label: 'Message shown when the remote ping fails',
    howToTest: 'Read the ping output from the remote network ping.',
    values: {
      unreachable_from_gateway: '"Reply from <your gateway>: Destination host unreachable"',
      unreachable_from_other_router: '"Reply from <another router>: Destination host unreachable"',
      timed_out: '"Request timed out"',
      [NOT_TESTED]: 'Not tested',
    },
  },
  routeToDestination: {
    label: 'The PC\'s gateway router has a route to the destination network',
    howToTest:
      'On the gateway router run show ip route. Look for the destination network, or a "Gateway of last resort".',
    values: yesNoValues,
  },
  aclOnPath: {
    label: 'An access list is applied to a router interface on the path',
    howToTest:
      'On each router on the path run show running-config and look for "ip access-group" under the interfaces.',
    values: yesNoValues,
  },
  internetPingFromPc: {
    label: 'Ping from the PC to an internet/ISP server by IP address',
    howToTest: 'On the PC run ping <internet or ISP server IP>.',
    values: pingValues,
  },
  internetPingFromRouter: {
    label: 'Ping from the edge router to the same internet/ISP server',
    howToTest: 'On the router connected to the ISP run ping <internet or ISP server IP>.',
    values: pingValues,
  },
  serverPingByIp: {
    label: 'Ping from the PC to a server by its IP address',
    howToTest: 'On the PC run ping <server IP>.',
    values: pingValues,
  },
  pingByName: {
    label: 'Ping from the PC to the same server by its name',
    howToTest: 'On the PC run ping <server name, e.g. www.netwise.local>.',
    values: pingValues,
  },
  dhcpServerLocation: {
    label: 'Where the DHCP server for this department is',
    howToTest:
      'Check your design: is the DHCP pool on the department\'s own gateway router, or on a server in another subnet?',
    values: {
      same_subnet: 'In the same subnet (for example the department\'s gateway router)',
      different_subnet: 'In a different subnet (for example a server in the Servers VLAN)',
      not_used: 'Not used; the PC has a static IP',
      [NOT_TESTED]: 'Not sure',
    },
  },
  ipConflictWarning: {
    label: 'IP address conflict detected',
    howToTest:
      'Look for an IP conflict message on the PC. Or run ipconfig /all on the PC to note its Physical Address, then ' +
      'run show ip arp on the router and check whether the PC\'s IP maps to a different MAC address.',
    values: {
      yes: 'Conflict seen (or the IP maps to another MAC)',
      no: 'No conflict',
      [NOT_TESTED]: 'Not checked',
    },
  },
  connectivityIntermittent: {
    label: 'Repeated pings give mixed results',
    howToTest: 'Run the same ping several times, ignoring the very first attempt.',
    values: {
      yes: 'Sometimes replies, sometimes fails',
      no: 'Results are consistent',
      [NOT_TESTED]: 'Not tested',
    },
  },
});

export const faults = deepFreeze([
  // ---------------------------------------------------------------- addressing
  {
    id: 'wrong-ip-or-mask',
    name: 'Wrong IP address or subnet mask on the PC',
    category: 'addressing',
    description:
      'The PC\'s IP address or subnet mask does not belong to its department\'s subnet, so it cannot talk to its ' +
      'gateway correctly. If the PC uses DHCP and received an address from another department\'s range, the switch ' +
      'port is probably in the wrong VLAN.',
    conditions: {
      required: { pcIpStatus: 'wrong_subnet_or_mask' },
      supporting: {
        gatewayPing: 'fail',
        otherVlanPing: 'fail',
        remoteNetworkPing: 'fail',
        linkLights: 'all_green',
      },
    },
    checks: [
      {
        device: 'pc',
        command: 'ipconfig',
        purpose: 'See the IP address and subnet mask the PC is using.',
        lookFor:
          'The IPv4 address must be between the first and last usable IP of the department in the plan, and the ' +
          'subnet mask must equal the plan\'s mask.',
      },
      {
        device: 'router',
        command: 'show ip interface brief',
        purpose: 'Confirm the gateway address the PC\'s subnet is built around.',
        lookFor: 'The interface or subinterface for this department should have the plan\'s default gateway IP.',
      },
    ],
    fix: {
      summary: 'Give the PC an unused IP address and the subnet mask from its department\'s subnet in the plan.',
      steps: [
        'On the PC open Desktop > IP Configuration.',
        'Enter an unused IP address between the plan\'s first and last usable IP (not the gateway address).',
        'Enter the subnet mask from the plan.',
      ],
      commands: [],
    },
    verify: [
      { device: 'pc', command: 'ipconfig', lookFor: 'The address and mask now match the plan.' },
      { device: 'pc', command: 'ping <default gateway IP>', lookFor: 'Replies from the gateway.' },
    ],
  },
  {
    id: 'wrong-default-gateway',
    name: 'Wrong default gateway on the PC',
    category: 'addressing',
    description:
      'The PC can reach devices in its own subnet, but it sends traffic for other networks to the wrong address, ' +
      'so everything outside the department fails.',
    conditions: {
      required: { pcGatewayMatchesPlan: 'no' },
      supporting: {
        pcIpStatus: 'in_planned_subnet',
        gatewayPing: 'success',
        sameVlanPing: 'success',
        otherVlanPing: 'fail',
        remoteNetworkPing: 'fail',
        remotePingMessage: 'timed_out',
      },
    },
    checks: [
      {
        device: 'pc',
        command: 'ipconfig',
        purpose: 'See which default gateway the PC is using.',
        lookFor: '"Default Gateway" must equal the default gateway shown for this department in the plan.',
      },
      {
        device: 'router',
        command: 'show ip interface brief',
        purpose: 'Find the router address the PC should use as its gateway.',
        lookFor: 'The IP on the interface or subinterface for this department. That address is the correct gateway.',
      },
      {
        device: 'pc',
        command: 'tracert <remote host IP>',
        purpose: 'See where traffic leaving the subnet goes.',
        lookFor: 'The first hop should be the plan\'s gateway. Timeouts from the first hop point to a wrong gateway.',
      },
    ],
    fix: {
      summary: 'Set the PC\'s default gateway to the router interface IP for its department.',
      steps: [
        'Static IP: on the PC open Desktop > IP Configuration and set Default Gateway to the plan\'s gateway.',
        'DHCP: correct the default-router in the department\'s DHCP pool (commands below), then renew the PC\'s address.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'ip dhcp pool <department pool name>' },
        { device: 'router', command: 'default-router <default gateway IP>' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'pc', command: 'ipconfig', lookFor: 'Default Gateway matches the plan.' },
      { device: 'pc', command: 'ping <remote host IP>', lookFor: 'Replies from the remote host.' },
    ],
  },
  {
    id: 'duplicate-ip',
    name: 'Duplicate IP address',
    category: 'addressing',
    description:
      'Two devices use the same IP address. The router sends replies to whichever device answered ARP last, so ' +
      'connectivity is unreliable for one or both devices.',
    conditions: {
      required: { ipConflictWarning: 'yes' },
      supporting: {
        connectivityIntermittent: 'yes',
        pcIpStatus: 'in_planned_subnet',
        pcGatewayMatchesPlan: 'yes',
        linkLights: 'all_green',
      },
    },
    checks: [
      {
        device: 'pc',
        command: 'ipconfig /all',
        purpose: 'Note this PC\'s MAC address.',
        lookFor: 'The "Physical Address". You will compare it with the router\'s ARP table.',
      },
      {
        device: 'router',
        command: 'show ip arp',
        purpose: 'See which MAC address the router has learned for the PC\'s IP.',
        lookFor:
          'The entry for the PC\'s IP. If its hardware address is not the PC\'s Physical Address, another device ' +
          'is using the same IP.',
      },
      {
        device: 'pc',
        command: 'arp -a',
        purpose: 'Run on another PC in the same subnet after pinging the address.',
        lookFor: 'The MAC listed for the IP should belong to the intended PC.',
      },
    ],
    fix: {
      summary: 'Give one of the devices a different, unused IP address from the subnet.',
      steps: [
        'Find the device using the conflicting IP (compare MAC addresses).',
        'Change one device to an unused IP between the plan\'s first and last usable IP.',
        'If a DHCP pool hands out addresses that are also used statically, exclude them from the pool.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'ip dhcp excluded-address <first static IP> <last static IP>' },
        { device: 'router', command: 'end' },
        { device: 'router', command: 'clear arp-cache' },
      ],
    },
    verify: [
      { device: 'router', command: 'show ip arp', lookFor: 'Each IP maps to exactly the expected MAC address.' },
      { device: 'pc', command: 'ping <default gateway IP>', lookFor: 'Consistent replies every time.' },
    ],
  },

  // ------------------------------------------------------------------ services
  {
    id: 'dhcp-server-problem',
    name: 'DHCP server or pool misconfigured',
    category: 'services',
    description:
      'The PC asked for an address but got no usable reply, so it gave itself a 169.254.x.x address. The DHCP ' +
      'service is off, the pool is missing or wrong, or the pool has no free addresses.',
    conditions: {
      required: {
        pcIpStatus: 'apipa_169_254',
        dhcpServerLocation: ['same_subnet', 'different_subnet'],
      },
      supporting: {
        dhcpServerLocation: 'same_subnet',
        linkLights: 'all_green',
      },
    },
    checks: [
      {
        device: 'pc',
        command: 'ipconfig /all',
        purpose: 'Confirm the PC is set to DHCP and did not get an address.',
        lookFor: 'An IPv4 address starting with 169.254 means no DHCP reply was received.',
      },
      {
        device: 'router',
        command: 'show ip dhcp pool',
        purpose: 'Check the pool for this department exists and has free addresses (router as DHCP server).',
        lookFor:
          'A pool whose network matches the department\'s subnet. If "Leased addresses" equals "Total addresses", ' +
          'the pool is full.',
      },
      {
        device: 'router',
        command: 'show running-config',
        purpose: 'Review the DHCP pool settings and exclusions.',
        lookFor:
          'Under "ip dhcp pool": the correct "network <subnet> <mask>" and "default-router". Check that ' +
          '"ip dhcp excluded-address" does not exclude the whole range.',
      },
      {
        device: 'router',
        command: 'show ip dhcp binding',
        purpose: 'See which clients received addresses.',
        lookFor: 'No entry for the PC\'s MAC address means it never received a lease.',
      },
    ],
    fix: {
      summary: 'Create or correct the DHCP pool for the department\'s subnet, then request a new address on the PC.',
      steps: [
        'Router as DHCP server: enter the commands below with values from the plan.',
        'Server device as DHCP server: open Services > DHCP, turn the service On, set the default gateway, DNS ' +
          'server, start IP and subnet mask for this subnet, then click Add or Save.',
        'On the PC open Desktop > IP Configuration, select Static and then DHCP again to request an address.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'ip dhcp excluded-address <gateway IP>' },
        { device: 'router', command: 'ip dhcp pool <department pool name>' },
        { device: 'router', command: 'network <subnet network address> <subnet mask>' },
        { device: 'router', command: 'default-router <default gateway IP>' },
        { device: 'router', command: 'dns-server <DNS server IP>' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'pc', command: 'ipconfig /renew', lookFor: 'An address inside the planned subnet.' },
      { device: 'router', command: 'show ip dhcp binding', lookFor: 'A binding for the PC\'s MAC address.' },
    ],
  },
  {
    id: 'dhcp-relay-missing',
    name: 'DHCP relay (ip helper-address) missing',
    category: 'services',
    description:
      'The DHCP server is in a different subnet. Routers do not forward DHCP broadcasts, so the department\'s ' +
      'gateway interface needs an ip helper-address pointing at the server.',
    conditions: {
      required: {
        pcIpStatus: 'apipa_169_254',
        dhcpServerLocation: 'different_subnet',
      },
      supporting: {
        linkLights: 'all_green',
      },
    },
    checks: [
      {
        device: 'pc',
        command: 'ipconfig',
        purpose: 'Confirm the PC failed to get an address.',
        lookFor: 'An address starting with 169.254 means no DHCP reply was received.',
      },
      {
        device: 'router',
        command: 'show ip interface <department gateway interface>',
        purpose: 'See whether DHCP requests from this department are forwarded.',
        lookFor:
          'A line "Helper address is <DHCP server IP>". If it says "Helper address is not set", relay is missing.',
      },
      {
        device: 'router',
        command: 'ping <DHCP server IP>',
        purpose: 'Make sure the router can reach the DHCP server.',
        lookFor: 'Replies. If this fails, fix routing to the server first.',
      },
    ],
    fix: {
      summary:
        'Add ip helper-address <DHCP server IP> on the router interface that is the department\'s default gateway.',
      steps: [
        'Use the subinterface for the department\'s VLAN, for example GigabitEthernet0/0.20 for VLAN 20.',
        'Make sure the DHCP server also has a pool for this department\'s subnet.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'interface <department gateway interface>' },
        { device: 'router', command: 'ip helper-address <DHCP server IP>' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'pc', command: 'ipconfig /renew', lookFor: 'An address inside the planned subnet.' },
    ],
  },
  {
    id: 'dns-problem',
    name: 'DNS server not set or not resolving',
    category: 'services',
    description:
      'The network path works (the server answers by IP), but the name cannot be turned into an address. The PC ' +
      'has the wrong DNS server, or the DNS server has no record for the name.',
    conditions: {
      required: {
        serverPingByIp: 'success',
        pingByName: 'fail',
      },
      supporting: {
        pcIpStatus: 'in_planned_subnet',
        gatewayPing: 'success',
      },
    },
    checks: [
      {
        device: 'pc',
        command: 'ipconfig /all',
        purpose: 'See which DNS server the PC uses.',
        lookFor: '"DNS Servers" must be the DNS server IP from your design.',
      },
      {
        device: 'pc',
        command: 'nslookup <server name>',
        purpose: 'Ask the DNS server to resolve the name directly.',
        lookFor:
          'An answer with the server\'s IP. A timeout means the DNS server is wrong or unreachable; a "not found" ' +
          'style reply means the record is missing.',
      },
      {
        device: 'pc',
        command: 'ping <DNS server IP>',
        purpose: 'Confirm the DNS server itself is reachable.',
        lookFor: 'Replies from the DNS server.',
      },
    ],
    fix: {
      summary: 'Point the PC at the correct DNS server and make sure that server has a record for the name.',
      steps: [
        'Static IP: on the PC open Desktop > IP Configuration and set DNS Server.',
        'DHCP: set dns-server in the department\'s DHCP pool (commands below), then renew the PC\'s address.',
        'On the DNS server device open Services > DNS, turn it On, and add an A record: name -> server IP.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'ip dhcp pool <department pool name>' },
        { device: 'router', command: 'dns-server <DNS server IP>' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'pc', command: 'nslookup <server name>', lookFor: 'The name resolves to the server\'s IP.' },
      { device: 'pc', command: 'ping <server name>', lookFor: 'Replies from the server.' },
    ],
  },

  // ----------------------------------------------------------------- switching
  {
    id: 'port-in-wrong-vlan',
    name: 'PC switch port is in the wrong VLAN',
    category: 'switching',
    description:
      'The switch port for the PC is assigned to a different VLAN (or the VLAN does not exist), so the PC is cut ' +
      'off from its own department and gateway even though its IP settings are correct.',
    conditions: {
      required: {
        gatewayPing: 'fail',
        sameVlanPing: 'fail',
        linkLights: 'all_green',
      },
      supporting: {
        otherVlansReachGateway: 'yes',
        pcGatewayMatchesPlan: 'yes',
        pcIpStatus: 'in_planned_subnet',
      },
    },
    checks: [
      {
        device: 'switch',
        command: 'show vlan brief',
        purpose: 'See which VLAN each switch port belongs to.',
        lookFor:
          'The PC\'s port (for example Fa0/5) must be listed under the department\'s VLAN ID from the plan. Also ' +
          'check the VLAN exists.',
      },
      {
        device: 'switch',
        command: 'show interfaces <PC port> switchport',
        purpose: 'Check the port mode and access VLAN.',
        lookFor: '"Administrative Mode: static access" and "Access Mode VLAN: <department VLAN ID>".',
      },
    ],
    fix: {
      summary: 'Create the department\'s VLAN if needed and assign the PC\'s port to it as an access port.',
      steps: ['Use the VLAN ID and department name from the NetWise plan.'],
      commands: [
        { device: 'switch', command: 'configure terminal' },
        { device: 'switch', command: 'vlan <department VLAN ID>' },
        { device: 'switch', command: 'name <department name>' },
        { device: 'switch', command: 'exit' },
        { device: 'switch', command: 'interface <PC port>' },
        { device: 'switch', command: 'switchport mode access' },
        { device: 'switch', command: 'switchport access vlan <department VLAN ID>' },
        { device: 'switch', command: 'end' },
      ],
    },
    verify: [
      { device: 'switch', command: 'show vlan brief', lookFor: 'The PC\'s port is under the correct VLAN.' },
      { device: 'pc', command: 'ping <default gateway IP>', lookFor: 'Replies from the gateway.' },
    ],
  },
  {
    id: 'trunk-misconfigured',
    name: 'Trunk link misconfigured',
    category: 'switching',
    description:
      'The link carrying VLANs between switches, or from the switch to the router, is not trunking, does not allow ' +
      'the department\'s VLAN, or has a native VLAN mismatch.',
    conditions: {
      required: {
        pcIpStatus: ['in_planned_subnet', 'apipa_169_254'],
        gatewayPing: 'fail',
        linkLights: 'all_green',
      },
      supporting: {
        otherVlansReachGateway: 'no',
        pcGatewayMatchesPlan: 'yes',
      },
    },
    checks: [
      {
        device: 'switch',
        command: 'show interfaces trunk',
        purpose: 'List trunk ports and the VLANs they carry.',
        lookFor:
          'The uplink port should be listed with Status "trunking". The department\'s VLAN must appear under ' +
          '"Vlans allowed and active in management domain", and the native VLAN must be the same on both ends.',
      },
      {
        device: 'switch',
        command: 'show interfaces <uplink port> switchport',
        purpose: 'Check the uplink port mode.',
        lookFor: '"Administrative Mode: trunk". "static access" means the uplink is not a trunk.',
      },
    ],
    fix: {
      summary: 'Make the uplink a trunk that allows every department VLAN, with the same native VLAN on both ends.',
      steps: [
        'Apply this on the switch port that connects to the router or to another switch.',
        'On multilayer switches (e.g. 3560) run "switchport trunk encapsulation dot1q" before "switchport mode trunk".',
      ],
      commands: [
        { device: 'switch', command: 'configure terminal' },
        { device: 'switch', command: 'interface <uplink port>' },
        { device: 'switch', command: 'switchport mode trunk' },
        { device: 'switch', command: 'switchport trunk allowed vlan <comma-separated VLAN IDs>' },
        { device: 'switch', command: 'end' },
      ],
    },
    verify: [
      {
        device: 'switch',
        command: 'show interfaces trunk',
        lookFor: 'The uplink is trunking and carries the department\'s VLAN.',
      },
      { device: 'pc', command: 'ping <default gateway IP>', lookFor: 'Replies from the gateway.' },
    ],
  },
  {
    id: 'interface-down',
    name: 'Interface shut down or cable disconnected',
    category: 'switching',
    description:
      'An interface on the path is administratively shut down, or the cable is missing, wrong or connected to the ' +
      'wrong port. Packet Tracer shows this as a red link light.',
    conditions: {
      required: { linkLights: 'some_red' },
      supporting: {
        gatewayPing: 'fail',
        sameVlanPing: 'fail',
      },
    },
    checks: [
      {
        device: 'router',
        command: 'show ip interface brief',
        purpose: 'See the state of every router interface.',
        lookFor:
          '"administratively down" means the interface is shut down. "down / down" means a cable problem or the ' +
          'other end is down. The interfaces you use should show "up / up".',
      },
      {
        device: 'switch',
        command: 'show ip interface brief',
        purpose: 'See the state of every switch port.',
        lookFor: 'The PC\'s port and the uplink port should be "up / up".',
      },
    ],
    fix: {
      summary: 'Bring the interface up with no shutdown, and check the cable and port match the design.',
      steps: [
        'If the interface is "administratively down", use the commands below.',
        'If it is "down / down", check the cable is connected to the planned ports and use a copper straight-through ' +
          'cable for PC-switch and switch-router links.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'interface <interface>' },
        { device: 'router', command: 'no shutdown' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'router', command: 'show ip interface brief', lookFor: 'The interface is "up / up".' },
      { device: 'pc', command: 'ping <default gateway IP>', lookFor: 'Replies from the gateway.' },
    ],
  },

  // ---------------------------------------------------------------- inter-vlan
  {
    id: 'subinterface-misconfigured',
    name: 'Router subinterface for the VLAN is wrong or missing',
    category: 'inter-vlan',
    description:
      'With router-on-a-stick, each department needs a router subinterface with the right 802.1Q VLAN tag and the ' +
      'plan\'s gateway IP. If one is missing or wrong, only that department loses its gateway.',
    conditions: {
      required: {
        pcIpStatus: ['in_planned_subnet', 'apipa_169_254'],
        gatewayPing: 'fail',
        sameVlanPing: 'success',
        otherVlansReachGateway: 'yes',
        linkLights: 'all_green',
      },
      supporting: {
        pcGatewayMatchesPlan: 'yes',
      },
    },
    checks: [
      {
        device: 'router',
        command: 'show ip interface brief',
        purpose: 'Check the department\'s subinterface exists and is up.',
        lookFor:
          'A subinterface such as GigabitEthernet0/0.<VLAN ID> with the plan\'s gateway IP and status "up / up".',
      },
      {
        device: 'router',
        command: 'show running-config',
        purpose: 'Check the subinterface configuration.',
        lookFor:
          'Under "interface <physical interface>.<VLAN ID>": "encapsulation dot1Q <department VLAN ID>" and ' +
          '"ip address <gateway IP> <subnet mask>". The physical interface must not be shut down.',
      },
    ],
    fix: {
      summary: 'Create or correct the subinterface with the department\'s VLAN tag and gateway IP from the plan.',
      steps: ['Use the VLAN ID, gateway IP and subnet mask from the department\'s row in the NetWise plan.'],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'interface <physical interface>.<department VLAN ID>' },
        { device: 'router', command: 'encapsulation dot1Q <department VLAN ID>' },
        { device: 'router', command: 'ip address <default gateway IP> <subnet mask>' },
        { device: 'router', command: 'exit' },
        { device: 'router', command: 'interface <physical interface>' },
        { device: 'router', command: 'no shutdown' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'router', command: 'show ip interface brief', lookFor: 'The subinterface is "up / up".' },
      { device: 'pc', command: 'ping <default gateway IP>', lookFor: 'Replies from the gateway.' },
      { device: 'pc', command: 'ping <IP of a PC in another department>', lookFor: 'Replies.' },
    ],
  },

  // ------------------------------------------------------------------- routing
  {
    id: 'missing-route',
    name: 'Missing route to the destination network',
    category: 'routing',
    description:
      'The PC reaches its gateway, but a router on the path has no route to the destination, or the far router ' +
      'has no route back. Covers both static routes and routing protocols such as OSPF.',
    conditions: {
      required: {
        gatewayPing: 'success',
        remoteNetworkPing: 'fail',
      },
      supporting: {
        pcGatewayMatchesPlan: 'yes',
        otherVlanPing: 'success',
        remotePingMessage: ['unreachable_from_gateway', 'unreachable_from_other_router'],
        routeToDestination: 'no',
        aclOnPath: 'no',
      },
    },
    checks: [
      {
        device: 'router',
        command: 'show ip route',
        purpose: 'List the networks this router knows how to reach.',
        lookFor:
          'The destination network with a code such as S (static), O (OSPF), D (EIGRP) or R (RIP), or a ' +
          '"Gateway of last resort". If neither is there, the route is missing. Repeat on each router on the path, ' +
          'and check the far router has a route back to the PC\'s network.',
      },
      {
        device: 'router',
        command: 'show ip protocols',
        purpose: 'If you use a routing protocol, check it is running and advertising the right networks.',
        lookFor: 'The protocol is listed and "Routing for Networks" includes the department subnets.',
      },
      {
        device: 'router',
        command: 'show ip ospf neighbor',
        purpose: 'If you use OSPF, check the neighboring router is known.',
        lookFor: 'Each neighbor router listed in state FULL. No neighbors means OSPF is not exchanging routes.',
      },
      {
        device: 'pc',
        command: 'tracert <remote host IP>',
        purpose: 'Find the router where traffic stops.',
        lookFor: 'The last hop that replies is the router with the missing route.',
      },
    ],
    fix: {
      summary: 'Add a static route to the destination network, or fix the routing protocol so the route is learned.',
      steps: [
        'Add the route on the router that is missing it, and a return route on the far router if that is missing.',
        'Using OSPF instead: under "router ospf 1" add "network <network> <wildcard mask> area 0" for each subnet.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'ip route <destination network> <subnet mask> <next-hop IP>' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'router', command: 'show ip route', lookFor: 'The destination network is now listed.' },
      { device: 'pc', command: 'ping <remote host IP>', lookFor: 'Replies from the remote host.' },
    ],
  },

  // ------------------------------------------------------------------ internet
  {
    id: 'default-route-missing',
    name: 'Default route to the ISP missing',
    category: 'internet',
    description:
      'Internal networks work, but the edge router does not know where to send traffic for unknown (internet) ' +
      'destinations, so neither the router nor the PCs can reach the internet.',
    conditions: {
      required: {
        internetPingFromPc: 'fail',
        internetPingFromRouter: 'fail',
      },
      supporting: {
        gatewayPing: 'success',
        remoteNetworkPing: 'success',
        linkLights: 'all_green',
      },
    },
    checks: [
      {
        device: 'router',
        command: 'show ip route',
        purpose: 'Check whether the edge router has a default route.',
        lookFor:
          '"Gateway of last resort is not set" means the default route is missing. A working one shows ' +
          '"S* 0.0.0.0/0".',
      },
      {
        device: 'router',
        command: 'ping <ISP next-hop IP>',
        purpose: 'Confirm the link to the ISP itself works.',
        lookFor: 'Replies. If this fails, check the ISP-facing interface first.',
      },
    ],
    fix: {
      summary: 'Add a default route on the edge router pointing to the ISP next hop.',
      steps: ['Internal routers also need a default route pointing towards the edge router.'],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'ip route 0.0.0.0 0.0.0.0 <ISP next-hop IP>' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'router', command: 'show ip route', lookFor: '"Gateway of last resort is <ISP next-hop IP>".' },
      { device: 'router', command: 'ping <internet server IP>', lookFor: 'Replies.' },
    ],
  },
  {
    id: 'nat-misconfigured',
    name: 'NAT/PAT misconfigured',
    category: 'internet',
    description:
      'The edge router can reach the internet using its own public address, but PCs with private addresses are not ' +
      'translated. Usually ip nat inside/outside is on the wrong interfaces, or the NAT access list does not match ' +
      'the department subnets.',
    conditions: {
      required: {
        internetPingFromRouter: 'success',
        internetPingFromPc: 'fail',
      },
      supporting: {
        gatewayPing: 'success',
        remoteNetworkPing: 'success',
        pcGatewayMatchesPlan: 'yes',
      },
    },
    checks: [
      {
        device: 'router',
        command: 'show ip nat translations',
        purpose: 'See whether the PC\'s traffic is being translated (ping from the PC first).',
        lookFor: 'An entry with the PC\'s private IP as "Inside local". An empty table means nothing is translated.',
      },
      {
        device: 'router',
        command: 'show ip nat statistics',
        purpose: 'Check which interfaces are inside and outside.',
        lookFor:
          'The LAN interfaces or subinterfaces under "Inside interfaces" and the ISP interface under "Outside ' +
          'interfaces". Rising "Misses" means packets are not matching the NAT rule.',
      },
      {
        device: 'router',
        command: 'show access-lists',
        purpose: 'Check the access list used by NAT matches the department subnets.',
        lookFor: 'A permit line covering each department subnet, with its match count rising when the PC pings.',
      },
    ],
    fix: {
      summary:
        'Mark LAN interfaces "ip nat inside" and the ISP interface "ip nat outside", and make the NAT access list ' +
        'permit the department subnets.',
      steps: [
        'With router-on-a-stick, put "ip nat inside" on every department subinterface.',
        'Use wildcard masks in the access list, for example 0.0.0.255 for a /24.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'access-list 1 permit <base network> <wildcard mask>' },
        { device: 'router', command: 'ip nat inside source list 1 interface <ISP interface> overload' },
        { device: 'router', command: 'interface <LAN interface or subinterface>' },
        { device: 'router', command: 'ip nat inside' },
        { device: 'router', command: 'exit' },
        { device: 'router', command: 'interface <ISP interface>' },
        { device: 'router', command: 'ip nat outside' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'pc', command: 'ping <internet server IP>', lookFor: 'Replies.' },
      { device: 'router', command: 'show ip nat translations', lookFor: 'An entry for the PC\'s private IP.' },
    ],
  },

  // ------------------------------------------------------------------ security
  {
    id: 'acl-blocking-traffic',
    name: 'Access list blocking the traffic',
    category: 'security',
    description:
      'Routing is correct, but an access list applied to a router interface denies the traffic. Remember every ' +
      'access list ends with an invisible "deny any".',
    conditions: {
      required: {
        aclOnPath: 'yes',
        gatewayPing: 'success',
      },
      supporting: {
        remotePingMessage: ['unreachable_from_gateway', 'unreachable_from_other_router'],
        routeToDestination: 'yes',
        pcGatewayMatchesPlan: 'yes',
      },
    },
    checks: [
      {
        device: 'router',
        command: 'show access-lists',
        purpose: 'See each access list and how many packets each line has matched.',
        lookFor:
          'A deny line whose match count goes up each time you ping. If no line matches, the implicit "deny any" ' +
          'at the end is blocking the traffic.',
      },
      {
        device: 'router',
        command: 'show ip interface <interface>',
        purpose: 'See which access list is applied to the interface and in which direction.',
        lookFor: '"Inbound access list is <name>" or "Outgoing access list is <name>".',
      },
    ],
    fix: {
      summary: 'Add a permit line for the needed traffic before the deny, or remove the access list from the interface.',
      steps: [
        'To confirm the access list is the cause, temporarily remove it from the interface and test again.',
        'Then add a permit line for the required traffic above the deny line, and re-apply the access list.',
      ],
      commands: [
        { device: 'router', command: 'configure terminal' },
        { device: 'router', command: 'interface <interface>' },
        { device: 'router', command: 'no ip access-group <ACL name or number> <in or out>' },
        { device: 'router', command: 'exit' },
        { device: 'router', command: 'ip access-list extended <ACL name or number>' },
        {
          device: 'router',
          command: '<sequence number lower than the deny> permit ip <source network> <wildcard> <destination network> <wildcard>',
        },
        { device: 'router', command: 'exit' },
        { device: 'router', command: 'interface <interface>' },
        { device: 'router', command: 'ip access-group <ACL name or number> <in or out>' },
        { device: 'router', command: 'end' },
      ],
    },
    verify: [
      { device: 'router', command: 'show access-lists', lookFor: 'The permit line\'s match count rises when you ping.' },
      { device: 'pc', command: 'ping <destination IP>', lookFor: 'Replies.' },
    ],
  },
]);
