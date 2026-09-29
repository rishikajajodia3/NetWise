// Guided ("basic") troubleshooting: a few plain-language questions per problem.
// Every answer maps to an existing symptom key and value from the backend's
// troubleshooting data, so the backend engine still makes the diagnosis.
// Unanswered questions are not sent, which the engine treats as "not tested".

const yesNo = (yes, no) => [
  { label: 'Yes', value: yes },
  { label: 'No', value: no },
];

const Q = {
  gatewayMatchesPlan: {
    symptom: 'pcGatewayMatchesPlan',
    question: "Does the PC's default gateway match the NetWise plan?",
    hint: 'On the PC run ipconfig and compare "Default Gateway" with the gateway in the plan.',
    options: yesNo('yes', 'no'),
  },
  gatewayPing: {
    symptom: 'gatewayPing',
    question: 'Can the PC ping its default gateway?',
    hint: 'Ping the gateway IP shown in the NetWise plan. Ignore a timeout on the very first reply.',
    options: yesNo('success', 'fail'),
  },
  otherVlanPing: {
    symptom: 'otherVlanPing',
    question: 'Can the PC ping a PC in another department?',
    hint: 'Ping the IP of a PC in a different department (VLAN).',
    options: yesNo('success', 'fail'),
  },
  sameVlanPing: {
    symptom: 'sameVlanPing',
    question: 'Can the PC ping another PC in its own department?',
    hint: 'Ping the IP of a PC in the same department (same VLAN).',
    options: yesNo('success', 'fail'),
  },
  otherVlansReachGateway: {
    symptom: 'otherVlansReachGateway',
    question: 'Can PCs in other departments ping their own default gateways?',
    hint: 'From a PC in a different department, ping that department\'s gateway.',
    options: yesNo('yes', 'no'),
  },
  linksGreen: {
    symptom: 'linkLights',
    question: 'Are the network links green?',
    hint: 'In Packet Tracer, check the link lights between the PC, the switch and the router.',
    options: yesNo('all_green', 'some_red'),
  },
  ipCorrect: {
    symptom: 'pcIpStatus',
    question: "Are the PC's IP address and subnet mask correct for its department?",
    hint: 'On the PC run ipconfig and compare the address and mask with the plan.',
    options: yesNo('in_planned_subnet', 'wrong_subnet_or_mask'),
  },
  ipAddressKind: {
    symptom: 'pcIpStatus',
    question: 'What IP address does the PC show?',
    hint: 'On the PC run ipconfig.',
    options: [
      { label: '169.254.x.x', value: 'apipa_169_254' },
      { label: 'An address from the plan', value: 'in_planned_subnet' },
      { label: 'A different address', value: 'wrong_subnet_or_mask' },
    ],
  },
  dhcpServer: {
    symptom: 'dhcpServerLocation',
    question: 'Where is the DHCP server for this department?',
    hint: 'Check your design in Packet Tracer.',
    options: [
      { label: 'On its gateway router', value: 'same_subnet' },
      { label: 'On a server in another network', value: 'different_subnet' },
      { label: 'Not used (static IP)', value: 'not_used' },
    ],
  },
  ipConflict: {
    symptom: 'ipConflictWarning',
    question: 'Did the PC report an IP address conflict?',
    hint: 'Look for an "IP address conflict" message on the PC.',
    options: yesNo('yes', 'no'),
  },
  internetFromPc: {
    symptom: 'internetPingFromPc',
    question: 'Can the PC ping an internet server by IP address?',
    hint: 'Ping the IP address of the ISP or internet server.',
    options: yesNo('success', 'fail'),
  },
  internetFromRouter: {
    symptom: 'internetPingFromRouter',
    question: 'Can the edge router ping the same internet server?',
    hint: 'On the router connected to the ISP, ping the same IP.',
    options: yesNo('success', 'fail'),
  },
  aclApplied: {
    symptom: 'aclOnPath',
    question: 'Is an access list (ACL) applied on the router?',
    hint: 'On the router run show running-config and look for "ip access-group".',
    options: yesNo('yes', 'no'),
  },
  serverPingByIp: {
    symptom: 'serverPingByIp',
    question: 'Can the PC ping the server by its IP address?',
    hint: 'For example ping 192.168.10.114.',
    options: yesNo('success', 'fail'),
  },
  pingByName: {
    symptom: 'pingByName',
    question: 'Can the PC ping the same server by its name?',
    hint: 'For example ping www.netwise.local.',
    options: yesNo('success', 'fail'),
  },
};

export const PROBLEMS = [
  {
    id: 'other-department',
    title: 'PC cannot reach another department',
    questions: [Q.gatewayMatchesPlan, Q.gatewayPing, Q.otherVlanPing, Q.linksGreen],
  },
  {
    id: 'gateway',
    title: 'PC cannot reach its gateway',
    questions: [Q.ipCorrect, Q.gatewayPing, Q.sameVlanPing, Q.otherVlansReachGateway, Q.linksGreen],
  },
  {
    id: 'no-connection',
    title: 'PC has no network connection',
    questions: [Q.ipAddressKind, Q.dhcpServer, Q.linksGreen, Q.ipConflict],
  },
  {
    id: 'internet',
    title: 'Internet is not reachable',
    questions: [Q.internetFromPc, Q.internetFromRouter, Q.gatewayPing, Q.aclApplied],
  },
  {
    id: 'dns',
    title: 'DNS/name resolution is not working',
    questions: [Q.serverPingByIp, Q.pingByName, Q.ipCorrect, Q.gatewayPing],
  },
];
