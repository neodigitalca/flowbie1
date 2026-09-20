import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const code = `<?php
$val = get_option('neo_pulse_wp_global_css');
echo wp_json_encode($val, JSON_PRETTY_PRINT);
`;

const res = await runNeodigitalPhp(code, "inspect-np-global-css.php");
console.log(res);
