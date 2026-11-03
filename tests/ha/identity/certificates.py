"""Print a throwaway CA and a certificate for Glow's identity host as JSON.

Runs inside the Home Assistant image, which ships the cryptography package.
"""

import datetime
import json
import sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

host = sys.argv[1]
now = datetime.datetime.now(datetime.UTC)


def pem(value):
    if isinstance(value, x509.Certificate):
        return value.public_bytes(serialization.Encoding.PEM).decode()
    return value.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()


def build(subject, issuer, key, signer, extensions):
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=1))
    )
    for extension, critical in extensions:
        builder = builder.add_extension(extension, critical=critical)
    return builder.sign(signer, hashes.SHA256())


ca_key = ec.generate_private_key(ec.SECP256R1())
ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Glow test CA")])
ca_id = x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key())
ca = build(
    ca_name,
    ca_name,
    ca_key,
    ca_key,
    [
        (x509.BasicConstraints(ca=True, path_length=0), True),
        (
            x509.KeyUsage(
                digital_signature=False,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            True,
        ),
        (ca_id, False),
    ],
)
key = ec.generate_private_key(ec.SECP256R1())
certificate = build(
    x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, host)]),
    ca_name,
    key,
    ca_key,
    [
        (x509.BasicConstraints(ca=False, path_length=None), True),
        (x509.SubjectAlternativeName([x509.DNSName(host)]), False),
        (x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), False),
        (x509.SubjectKeyIdentifier.from_public_key(key.public_key()), False),
        (x509.AuthorityKeyIdentifier.from_issuer_subject_key_identifier(ca_id), False),
    ],
)
print(json.dumps({"ca": pem(ca), "certificate": pem(certificate), "key": pem(key)}))
